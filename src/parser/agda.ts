import * as _ from 'lodash';
import { ParseError } from '../error';
import { Agda } from '../type';

function parseAgdaResponse(raw: string): Promise<Agda.Action> {

    const tokens: any[] = parseSExpression(raw);

    switch (tokens[0]) {
        case 'agda2-info-action':
            let type = parseInfoActionType(tokens[1]);
            let content = tokens.length === 3 ? [] : _.compact(tokens[2].split('\\n'));
            return Promise.resolve({
                kind: 'InfoAction',
                infoActionKind: type,
                content: content
            } as Agda.InfoAction);
        case 'agda2-status-action':
            return Promise.resolve({
                kind: 'StatusAction',
                content: tokens.slice(1, 2)
            } as Agda.StatusAction);
        case 'agda2-goals-action':
            return Promise.resolve({
                kind: 'GoalsAction',
                content: tokens[1].map((s) => parseInt(s))
            } as Agda.GoalsAction);
        case 'agda2-give-action':
            let index = parseInt(tokens[1]);
            // with parenthesis: ["agda2-give-action", 1, "paren"]
            // w/o  parenthesis: ["agda2-give-action", 1, "no-paren"]
            // with content    : ["agda2-give-action", 0, ...]
            switch (tokens[2]) {
                case 'paren': return Promise.resolve({
                        kind: 'GiveAction',
                        index: index,
                        content: '',
                        hasParenthesis: true
                    } as Agda.GiveAction);
                case 'no-paren': return Promise.resolve({
                        kind: 'GiveAction',
                        index: index,
                        content: '',
                        hasParenthesis: false
                    } as Agda.GiveAction);
                default: return Promise.resolve({
                        kind: 'GiveAction',
                        index: index,
                        content: tokens[2],
                        hasParenthesis: false
                    } as Agda.GiveAction);
            }
        case 'agda2-parse-error':
            return Promise.reject(new ParseError(
                raw,
                'agda2-parse-error'
            ))
        case 'agda2-goto':
        case 'agda2-maybe-goto':
            return Promise.resolve({
                kind: 'Goto',
                filepath: tokens[1][0],
                position: parseInt(tokens[1][2])
            } as Agda.Goto);
        case 'agda2-solveAll-action':
            return Promise.resolve({
                kind: 'SolveAllAction',
                solutions: _.chunk(tokens[1], 2).map((arr) => {
                    return { index: parseInt(arr[0] as string), expression: arr[1] }
                })
            } as Agda.SolveAllAction);
        case 'agda2-make-case-action':
            return Promise.resolve({
                kind: 'MakeCaseAction',
                content: tokens[1]
            } as Agda.MakeCaseAction);
        case 'agda2-make-case-action-extendlam':
            return Promise.resolve({
                kind: 'MakeCaseActionExtendLam',
                content: tokens[1]
            } as Agda.MakeCaseActionExtendLam);
        case 'agda2-highlight-clear':
            return Promise.resolve({
                kind: 'HighlightClear',
            } as Agda.HighlightClear);
        case 'agda2-highlight-add-annotations':
            let annotations: Agda.Annotation[] = _
                .tail(tokens)
                .map(parseAnnotation);
            return Promise.resolve({
                kind: 'HighlightAddAnnotations',
                content: annotations
            } as Agda.HighlightAddAnnotations);
        case 'agda2-highlight-load-and-delete-action':
            return Promise.resolve({
                kind: 'HighlightLoadAndDeleteAction',
                content: tokens[1]
            } as Agda.HighlightLoadAndDeleteAction);
        default:
            return Promise.reject(new ParseError(
                raw,
                'Unknown Agda action'
            ));
    }
}

function parseInfoActionType(raw: String): Agda.InfoActionKind {
    switch (raw) {
        case '*All Goals*':         return 'AllGoals';
        case '*All Done*':          return 'AllGoals'; // since Agda-2.6
        case '*Error*':             return 'Error';
        case '*Type-checking*':     return 'TypeChecking';
        case '*Current Goal*':      return 'CurrentGoal';
        case '*Inferred Type*':     return 'InferredType';
        case '*Module contents*':   return 'ModuleContents';
        case '*Context*':           return 'Context';
        case '*Goal type etc.*':    return 'GoalTypeEtc';
        case '*Normal Form*':       return 'NormalForm';
        case '*Intro*':             return 'Intro';
        case '*Auto*':              return 'Auto';
        case '*Constraints*':       return 'Constraints';
        case '*Scope Info*':        return 'ScopeInfo';
        default:                    return 'Unknown';
    }
}

function parseAnnotation(obj: any[]): Agda.Annotation {
    if (obj[4]) {
        return {
            start: obj[0],
            end: obj[1],
            type: obj[2],
            source: {
                filepath: obj[4][0],
                index: obj[4][2]
            }
        };

    } else {
        return {
            start: obj[0],
            end: obj[1],
            type: obj[2]
        };
    }
}

////////////////////////////////////////////////////////////////////////////////
//  Parsing S-Expressions
////////////////////////////////////////////////////////////////////////////////
function parse_sexp(string: string): any {
    var sexp = [[]];
    var word = '';
    var in_str = false;

    function pushInLast(elem) {
        sexp[sexp.length - 1].push(elem);
    }

    for (var i = 0; i < string.length; i++) {
        var char = string[i];
        if (char == '\'' && !in_str) {
            // drop all single quotes: 'param => param
        } else if (char == '(' && !in_str) {
            sexp.push([]);
        } else if (char == ')' && !in_str) {
            if (word != '') {
                pushInLast(word);
                word = '';
            }
            pushInLast(sexp.pop());
        } else if (char == ' ' && !in_str) {
            if (word != '') {
                pushInLast(word);
                word = '';
            }
        } else if (char == '\"') {
            in_str = !in_str;
        } else {
            word += char;
        }
    }
    return sexp[0];
}

function parseSExpression(s: string): any {
    return parse_sexp(preprocess(s))[0];
}

function preprocess(chunk: string): string {
    // polyfill String::startsWith
    if (chunk.substr(0, 6) === '((last') {
        // drop priority prefixes like ((last . 1)) as they are all constants with respect to responses
        //
        // the following text from agda-mode.el explains what are those
        // "last . n" prefixes for:
            // Every command is run by this function, unless it has the form
            // \"(('last . priority) . cmd)\", in which case it is run by
            // `agda2-run-last-commands' at the end, after the Agda2 prompt
            // has reappeared, after all non-last commands, and after all
            // interactive highlighting is complete. The last commands can have
            // different integer priorities; those with the lowest priority are
            // executed first.
        let index = chunk.indexOf('(agda');
        let length = chunk.length;
        chunk = chunk.substring(index, length - 1);
    }
    if (chunk.substr(0, 13) === 'cannot read: ') {
        // handles Agda parse error
        chunk = chunk.substring(12);
        chunk = `(agda2-parse-error${chunk})`;
    }
    // Replace window's \\ in paths with /, so that \n doesn't get treated as newline.
    chunk = chunk.replace(/\\\\/g, "/");
    return chunk;
}

export {
    parseAgdaResponse,
    parseAnnotation,
    parseSExpression
}
