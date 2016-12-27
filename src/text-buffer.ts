import * as fs from 'fs';
import * as Promise from 'bluebird';
import * as _ from 'lodash';
import { Agda, Goal, View, Location } from './types';
import { parseHole } from './parser';
import Core from './core';
import { OutOfGoalError, EmptyGoalError } from './error';
import { Command } from './types';

declare var atom: any;

export default class TextBuffer {
    private goals: Goal[]

    constructor(private core: Core) {
        this.goals = [];
        this.core = core;
    }

    /////////////////////////
    //  Cursor Management  //
    /////////////////////////

    // shift cursor if in certain goal
    protectCursor<T>(callback: () => T): Promise<T> {
        let position = this.core.editor.getCursorBufferPosition();
        let result = callback();
        return this.getCurrentGoal(position)
            .then((goal) => {
                // reposition the cursor in the goal only if it's a fresh hole (coming from '?')
                let isFreshHole = goal.isEmpty();
                if (isFreshHole) {
                    let newPosition = this.core.editor.translate(goal.range.start, 3);
                    setTimeout(() => {
                        this.core.editor.setCursorBufferPosition(newPosition);
                    });
                } else {
                    this.core.editor.setCursorBufferPosition(position);
                }
                return result;
            }).catch(OutOfGoalError, () => {
                this.core.editor.setCursorBufferPosition(position);
                return result;
            })
    }

    focus() {
        let textEditorElement = atom.views.getView(this.core.editor);
        textEditorElement.focus();
    }


    ///////////////////////
    //  File Management  //
    ///////////////////////

    saveBuffer() {
        this.core.editor.save();
    }

    ///////////////////////
    //  Goal Management  //
    ///////////////////////

    removeGoals() {
        this.goals.forEach((goal) => {
            goal.destroy();
        });
        this.goals = [];
    }

    removeGoal(index: number) {
        this.goals
            .filter((goal) => { return goal.index === index; })
            .forEach((goal) => { goal.destroy(); });
        this.goals = this.goals
                .filter((goal) => { return goal.index !== index; })
    }

    findGoal(index: number): Goal {
        let goals = this.goals.filter((goal) => { return goal.index === index; })
        return goals[0];
    }

    getCurrentGoal(cursor = this.core.editor.getCursorBufferPosition()): Promise<Goal> {
        const goals = this.goals.filter((goal) => {
            return goal.range.containsPoint(cursor, false);
        });

        if (_.isEmpty(goals))
            return Promise.reject(new OutOfGoalError('out of goal'));
        else
            return Promise.resolve(goals[0]);
    }

    warnOutOfGoal() {
        console.log('beep', this)
        this.core.view.set('Out of goal', ['For this command, please place the cursor in a goal'], View.Style.Warning);
    }

    warnEmptyGoal(error: any) {
        this.core.view.set('No content', [error.message], View.Style.Warning);
    }

    // reject if goal is empty
    guardGoalHasContent(goal : Goal): Promise<Goal> {
        if (goal.getContent()) {
            return Promise.resolve(goal);
        } else {
            return Promise.reject(new EmptyGoalError('goal is empty', goal));
        }
    }


    ////////////////
    //  Commands  //
    ////////////////
    nextGoal(): Promise<{}> {
        const cursor = this.core.editor.getCursorBufferPosition();
        let nextGoal = null;

        const positions = this.goals.map((goal) => {
            const start = goal.range.start;
            return this.core.editor.translate(start, 3);
        });

        positions.forEach((position) => {
            if (position.isGreaterThan(cursor) && nextGoal === null) {
                nextGoal = position;
            }
        });

        // no goal ahead of cursor, loop back
        if (nextGoal === null)
            nextGoal = _.head(positions)

        // jump only when there are goals
        if (!_.isEmpty(positions))
            this.core.editor.setCursorBufferPosition(nextGoal);

        return Promise.resolve({});
    }

    previousGoal(): Promise<{}> {
        const cursor = this.core.editor.getCursorBufferPosition();
        let previousGoal = null;

        const positions = this.goals.map((goal) => {
            const start = goal.range.start;
            return this.core.editor.translate(start, 3);
        });

        positions.forEach((position) => {
            if (position.isLessThan(cursor)) {
                previousGoal = position;
            }
        });

        // no goal ahead of cursor, loop back
        if (previousGoal === null)
            previousGoal = _.last(positions)

        // jump only when there are goals
        if (!_.isEmpty(positions))
            this.core.editor.setCursorBufferPosition(previousGoal);

        return Promise.resolve({});
    }

    jumpToGoal(index: number) {
        let goal = this.goals.filter((goal) => { return goal.index === index })[0];
        if (goal) {
            let start = goal.range.start;
            let position = this.core.editor.translate(start, 3);
            this.core.editor.setCursorBufferPosition(position);
            this.focus();
        }
    }

    jumpToLocation(location: Location) {
        this.focus();
        if (location.path) {
            atom.workspace.open(location.path)
                .then(editor => {
                    editor.setSelectedBufferRange(location.range, true);
                })
        } else {
            this.getCurrentGoal()
                .then((goal) => {
                    let range;
                    if (location.range.start.row === 0) {
                        range = location.range
                            .translate(goal.range.start)
                            .translate([0, 3]);  // hole boundary
                    } else {
                        range = location.range
                            .translate([goal.range.start.row, 0]);
                    }
                    this.core.editor.setSelectedBufferRange(range, true);
                }).catch(() => this.warnOutOfGoal());
        }
    }


    ////////////////////////
    //  Command Handlers  //
    ////////////////////////

    onGoalsAction(indices: number[]): Promise<void> {
        return this.protectCursor(() => {
            let textRaw = this.core.editor.getText();
            this.removeGoals();
            parseHole(textRaw, indices).forEach((hole) => {
                let range = this.core.editor.fromCIRange(hole.originalRange);
                this.core.editor.setTextInBufferRange(range, hole.content);
                let goal = new Goal(
                    this.core.editor,
                    hole.index,
                    hole.modifiedRange.start,
                    hole.modifiedRange.end
                );
                this.goals.push(goal);
            });
        });
    }

    onSolveAllAction(index: number, content: string): Promise<Goal> {
        return this.protectCursor(() => {
            let goal = this.findGoal(index);
            goal.setContent(content);
            return goal;
        });
    }

    onGiveAction(index: number, content: string, hasParenthesis: boolean): Promise<void> {
        return this.protectCursor(() => {
            let goal = this.findGoal(index);
            if (!_.isEmpty(content)) {
                content = content.replace(/\\n/g, '\n');
                goal.setContent(content);
            }
            if (hasParenthesis) {
                content = goal.getContent();
                goal.setContent(`(${content})`);
            }
            goal.removeBoundary();
            this.removeGoal(index);
        });
    }

    onMakeCaseAction(content: string[]): Promise<void> {
        return this.protectCursor(() => {
            this.getCurrentGoal().then((goal) => {
                goal.writeLines(content);
            }).catch(() => this.warnOutOfGoal());
        });
    }

    onMakeCaseActionExtendLam(content: string[]): Promise<void> {
        return this.protectCursor(() => {
            this.getCurrentGoal().then((goal) => {
                goal.writeLambda(content);
            }).catch(() => this.warnOutOfGoal());
        });
    }

    onGoto(filepath: string, charIndex: number) {
        if (this.core.getPath() === filepath) {
            let position = this.core.editor.fromIndex(charIndex - 1);
            this.core.editor.setCursorBufferPosition(position);
        }
    }

    // Agda generates files with syntax highlighting notations,
    // those files are temporary and should be deleted once used.
    // note: no highlighting yet, we'll just delete them.
    onHighlightLoadAndDelete(filepath: string) {
        fs.unlink(filepath);
    }
}
