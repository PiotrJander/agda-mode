import * as _ from 'lodash';;
import { normalize } from 'path';
import { parseFilepath } from './util';
import { View, Error, Location, Occurence } from '../types';
import { Parser, seq, alt, takeWhile, sepBy1, all, any, custom, succeed,
    regex, digits, string
    } from 'parsimmon';

var { Point, Range } = require('atom');

function parseContent(lines: string[]): View.Content {
    const {banner, body} = divideContent(lines);
    const bannerItems = concatItems(banner).map(parseBannerItem);
    const bodyItems = concatItems(body).map(parseBodyItem);
    return {
        banner: bannerItems,
        body: bodyItems
    }
}


// divide content into header and body
function divideContent(lines: string[]): {
    banner: string[],
    body: string[]
} {
    const notEmpty = lines.length > 0;
    const index = lines.indexOf('————————————————————————————————————————————————————————————');
    const isSectioned = index !== -1;

    if (notEmpty && isSectioned) {
        return {
            banner: lines.slice(0, index),
            body: lines.slice(index + 1, lines.length)
        }
    }
    else {
        return {
            banner: [],
            body: lines
        }
    }
}

// concatenate multiline judgements
function concatItems(lines: string[]): string[] {


    function isNewLine({ line, nextLine, index }): boolean {
        //      Goal: Banana
        const goal = /^Goal\: \S*/;

        //      Have: Banana
        const have = /^Have\: \S*/;

        //      Sort 123
        const sort = /^Sort \S*/;

        //      banana : Banana
        const completeJudgement = /^[^\(\{\s]+\s+\:\s* \S*/;

        // case when the term's name is too long, the rest of the judgement
        // would go to the next line, e.g:
        //      banananananananananananananananana
        //          : Banana
        const reallyLongTermIdentifier = /^\S+$/;
        const restOfTheJudgement = /^\s*\:\s* \S*$/;

        return goal.test(line)
        || have.test(line)
        || sort.test(line)
        || reallyLongTermIdentifier.test(line) && (nextLine && restOfTheJudgement.test(nextLine))
        || completeJudgement.test(line)
    }


    const newLineIndices = lines.map((line, index) => {
            return {
                line: line,
                nextLine: lines[index + 1],
                index: index
            }
        })
        .filter(obj => isNewLine(obj))
        .map(pair => pair.index)

    const aggregatedLines = newLineIndices.map((index, i) => {
            if (i === newLineIndices.length - 1) {
                // the last inteval
                return [index, lines.length];
            } else {
                return [index, newLineIndices[i + 1]];
            }
        }).map(interval => {
            return lines.slice(interval[0], interval[1]).join('\n');
        });

    return aggregatedLines;
}


////////////////////////////////////////////////////////////////////////////////
//  Components
////////////////////////////////////////////////////////////////////////////////


function parseBannerItem(str: string): View.BannerItem {
    const regex = /^(Goal|Have)\: ((?:\n|.)+)/;
    const result = str.match(regex);
    return {
        label: result[1],
        type: result[2]
    };
}

function parseOccurence(str: string): Occurence {
    const regex = /((?:\n|.)*\S+)\s*\[ at (.+):(?:(\d+)\,(\d+)\-(\d+)\,(\d+)|(\d+)\,(\d+)\-(\d+)) \]/;
    const result = str.match(regex);

    if (result) {
        const rowStart = parseInt(result[3]) ? parseInt(result[3]) : parseInt(result[7]);
        const rowEnd   = parseInt(result[5]) ? parseInt(result[5]) : parseInt(result[7]);
        const colStart = parseInt(result[4]) ? parseInt(result[4]) : parseInt(result[8]);
        const colEnd   = parseInt(result[6]) ? parseInt(result[6]) : parseInt(result[9]);
        const range = new Range(
            new Point(rowStart - 1, colStart - 1),
            new Point(rowEnd - 1, colEnd - 1)
        );
        return {
            body: result[1],
            location: {
                path: parseFilepath(result[2]),
                range: range,
                isSameLine: result[3] === undefined
            }
        };
    }
}


function parseGoal(str: string): View.Goal {
    const regex = /^(\?\d+) \: ((?:\n|.)+)/;
    const result = str.match(regex);
    if (result) {
        return {
            judgementForm: 'goal',
            index: result[1],
            type: result[2]
        };
    }
}

function parseJudgement(str: string): View.Judgement {
    const regex = /^(?:([^\_\?](?:[^\:])*)) \: ((?:\n|.)+)/;
    const result = str.match(regex);
    if (result) {
        return {
            judgementForm: 'type judgement',
            expr: result[1],
            type: result[2]
        };
    }
}

function parseMeta(str: string): View.Meta {
    const regex = /^(.+) \: ((?:\n|.)+)/;
    const result = str.match(regex);

    const occurence = parseOccurence(str);
    if (occurence) {
        const result = occurence.body.match(regex);
        if (result) {
            return {
                judgementForm: 'meta',
                index: result[1],
                type: result[2],
                location: occurence.location
            };
        }
    }
}

function parseTerm(str: string): View.Term {
    const regex = /^((?:\n|.)+)/;
    const result = str.match(regex);
    if (result) {
        return {
            judgementForm: 'term',
            expr: result[1]
        };
    }
}

function parseSort(str: string): View.Sort {
    const regex = /^Sort ((?:\n|.)+)/;
    const occurence = parseOccurence(str);
    if (occurence) {
        const result = occurence.body.match(regex);
        if (result) {
            return {
                judgementForm: 'sort',
                index: result[1],
                location: occurence.location
            };
        }
    }
}

function parseBodyItem(str: string): View.BodyItem {
    return parseGoal(str) || parseJudgement(str) || parseMeta(str) || parseSort(str) || parseTerm(str);
}


function parseLocation(str: string): Location {
    const regex = /(?:(.+):)?(?:(\d+)\,(\d+)\-(\d+)\,(\d+)|(\d+)\,(\d+)\-(\d+))/;
    const result = str.match(regex);
    if (result) {
        const rowStart = parseInt(result[2]) ? parseInt(result[2]) : parseInt(result[6]);
        const rowEnd   = parseInt(result[4]) ? parseInt(result[4]) : parseInt(result[6]);
        const colStart = parseInt(result[3]) ? parseInt(result[3]) : parseInt(result[7]);
        const colEnd   = parseInt(result[5]) ? parseInt(result[5]) : parseInt(result[8]);
        const range = new Range(
            new Point(rowStart - 1, colStart - 1),
            new Point(rowEnd - 1, colEnd - 1)
        );
        return {
            path: parseFilepath(result[1]),
            range: range,
            isSameLine: result[2] === undefined
        };
    }
}

export {
    parseContent
}
