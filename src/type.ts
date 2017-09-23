import Goal from './goal';
import * as Promise from 'bluebird';
import { EventEmitter } from 'events';
import { ParsedPath } from 'path';
import { Duplex } from 'stream';

type Range = any;
export type GUID = string;

export type TextInput = string;

interface IndexRange {
    start: number,
    end: number
}

interface Token {
    content: string,
    range: IndexRange,
    type: TokenType
}

const enum TokenType {
    Raw,
    Comment,
    GoalBracket,
    GoalQMRaw, // ? + ?
    GoalQM // ?
}

interface Hole {
    index: number,
    modifiedRange: IndexRange,
    originalRange: IndexRange,
    content: string
}

export interface Parsed<T> {
    raw: string;
    parsed: T
}

//
//  View
//

namespace View {

    export interface State {
        view: ViewState;
        mode: Mode;
        connection: ConnectionState;
        protocol: Protocol;
        header: HeaderState;
        inputMethod: InputMethodState;
        query: QueryState;
        body: BodyState;
        settings: SettingsPath;
    }

    export const enum Mode {
        Display,
        Query,
        QueryConnection
    }

    export interface ConnectionState {
        connectionInfos: ConnectionInfo[];
        selected?: GUID;
        connected?: GUID;
        erred: GUID[];
        showNewConnectionView: boolean;
    }

    export interface Protocol {
        log: ReqRes[];
        lsp: boolean;
    }

    // a request-response pair
    export interface ReqRes {
        request: Parsed<Agda.Command>
        responses: Parsed<Agda.Response>[];
    }

    export interface ViewState {
        activated: boolean;
        mounted: boolean;
        mountAt: {
            previous: MountingPosition,
            current: MountingPosition
        };
        settingsView: boolean;
    }

    export const enum MountingPosition {
        Pane,
        Bottom
    }

    export interface InputMethodState {
        activated: boolean;
        buffer: string;
        translation: string;
        further: boolean;
        keySuggestions: string[];
        candidateSymbols: string[];
    }

    export const enum Style {
        PlainText,
        Info,
        Success,
        Error,
        Warning
    }

    export interface HeaderState {
        text: string;
        style: Style;
    }

    export interface QueryState {
        placeholder: string;
        value: string;
    }

    export interface BodyState {
        banner: BannerItem[];
        body: Body;
        error: Error;
        plainText: string;
        maxBodyHeight: number;
    }

    export type SettingsPath = '/'
        | '/Connections' | '/Connections/New'
        | '/Protocol';


    // Legacy shit below


    export const enum Type {
        PlainText,
        Error,
        Warning,
        Judgement,
        Value
    }

    export type JudgementForm = 'goal' |
        'type judgement' |
        'meta' |
        'term' |
        'sort' ;


    ////////////////////////////////////////////
    // Body components
    ////////////////////////////////////////////

    export interface Judgements {
        banner: BannerItem[],
        body: BodyItem[]
    }

    export interface BannerItem {
        type: string,
        label: string
    }

    export interface Goal {
        judgementForm: JudgementForm,
        type: string,
        index: string
    }

    export interface Judgement {
        judgementForm: JudgementForm,
        type: string,
        expr: string,
        index?: string
    }

    export interface Term {
        judgementForm: JudgementForm,
        expr: string
    }

    export interface Meta {
        judgementForm: JudgementForm,
        type: string,
        location: Location,
        index: string
    }

    export interface Sort {
        judgementForm: JudgementForm,
        location: Location,
        index: string
    }


    export type BodyItem = Goal | Judgement | Term | Meta | Sort;

    export interface Body {
        goal: Goal[],
        judgement: Judgement[],
        term: Term[],
        meta: Meta[],
        sort: Sort[]
    }

}

namespace Agda {
    //
    //  Commands sent to Agda
    //
    export type CommandKind = 'Load' | 'Quit' | 'Restart' | 'Compile' |
        'ToggleDisplayOfImplicitArguments' | 'Info' | 'ShowConstraints' |
        'SolveConstraints' | 'ShowGoals' | 'NextGoal' | 'PreviousGoal' |
        'ToggleDocking' |
        'WhyInScope' | 'InferType' | 'ModuleContents' | 'ComputeNormalForm' |
        'Give' | 'Refine' | 'Auto' | 'Case' |
        'GoalType' | 'Context' | 'GoalTypeAndContext' | 'GoalTypeAndInferredType' |
        'InputSymbol' | 'InputSymbolCurlyBracket' | 'InputSymbolBracket'
        | 'InputSymbolParenthesis' | 'InputSymbolDoubleQuote' | 'InputSymbolSingleQuote'
        | 'InputSymbolBackQuote'

    export type Normalization = 'Simplified' | 'Instantiated' | 'Normalised';
    export type ComputeMode = 'DefaultCompute' | 'IgnoreAbstract' | 'UseShowInstance';

    export type Command = {
        kind: CommandKind,
        normalization?: Normalization,
        computeMode?: ComputeMode,
    }

    //
    //  Response from Agda
    //
    export type Response =
        // Resp_HighlightingInfo
        HighlightingInfo_Direct |
        HighlightingInfo_Indirect |
        // Resp_Status
        Status |
        // Resp_JumpToError
        JumpToError |
        // Resp_InteractionPoints
        InteractionPoints |
        // Resp_GiveAction
        GiveAction |

        InfoAction |
        SolveAllAction |
        MakeCaseAction |
        MakeCaseActionExtendLam |
        HighlightClear

    // Resp_HighlightingInfo HighlightingInfo HighlightingMethod ModuleToSource
    export interface HighlightingInfo_Direct {
        kind: 'HighlightingInfo_Direct';
        annotations: Annotation[];
    }

    export interface HighlightingInfo_Indirect {
        kind: 'HighlightingInfo_Indirect';
        filepath: string;
    }

    export interface Annotation {
        start: string,
        end: string,
        type: string[]
        source?: {
            filepath: string,
            index: string
        }
    }

    // Resp_Status Status
    export interface Status {
        kind: 'Status';
        // Are implicit arguments displayed?
        showImplicit: boolean;
        // Has the module been successfully type checked?
        checked: boolean;
    }

    // Resp_JumpToError FilePath Int32
    export interface JumpToError {
        kind: 'JumpToError';
        filepath: string;
        position: number;
    }

    // Resp_InteractionPoints [InteractionId]
    export interface InteractionPoints {
        kind: 'InteractionPoints';
        indices: number[];
    }

    // Resp_GiveAction InteractionId GiveResult
    export interface GiveAction {
        kind: 'GiveAction';
        index: number;
        giveResult: 'Paren' | 'NoParen' | 'String';
        result: string;
    }

    export type InfoActionKind = 'AllGoals' | 'Error' | 'TypeChecking' | 'CurrentGoal' |
        'InferredType' | 'ModuleContents' | 'Context' | 'GoalTypeEtc' |
        'NormalForm' | 'Intro' | 'Auto' | 'Constraints' | 'ScopeInfo' |
        'Unknown';

    export interface InfoAction {
        kind: 'InfoAction';
        infoActionKind: InfoActionKind;
        content: string[];
    }
    export interface SolveAllAction {
        kind: 'SolveAllAction';
        solutions: {
            index: number,
            expression: string
        }[];
    }
    export interface MakeCaseAction {
        kind: 'MakeCaseAction';
        content: string[];
    }
    export interface MakeCaseActionExtendLam {
        kind: 'MakeCaseActionExtendLam';
        content: string[];
    }
    export interface HighlightClear {
        kind: 'HighlightClear';
        content: string[];
    }
}

//
// export type PendingCommand = {
//     kind: CommandKind,
//     resolve: (kind: CommandKind) => void,
//     reject: (any) => void,
//     // the expected number of GoalsAction replies left
//     count: number,
// };

// Occurence & Location
export interface Occurence {
    location: Location,
    body: string
}

export interface Location {
    path: string,
    range: Range,
    isSameLine: boolean
}


// type Suggestion = string[];
////////////////////////////////////////////
// Errors
////////////////////////////////////////////

type Error
    = Error.NotInScope
    | Error.BadConstructor
    | Error.ConstructorTarget
    | Error.CaseSingleHole
    | Error.DefinitionTypeMismatch
    | Error.FunctionType
    | Error.IlltypedPattern
    | Error.LibraryNotFound
    | Error.MissingType
    | Error.MissingDefinition
    | Error.ModuleMismatch
    | Error.MultipleDefinition
    | Error.Parse
    | Error.PatternMatchOnNonDatatype
    | Error.RHSOmitted
    | Error.TypeMismatch
    | Error.Termination
    | Error.UnparsedButLocated
    | Error.Unparsed;

namespace Error {
    export interface NotInScope {
        kind: 'NotInScope',
        header: string,
        location: Location,
        suggestion: string[],
        expr: string
    }

    export interface TypeMismatch {
        kind: 'TypeMismatch',
        header: string,
        location: Location
        expected: string,
        expectedType: string,
        actual: string,
        expr: string,
        exprType: string
    }


    export interface BadConstructor {
        kind: 'BadConstructor',
        header: string,
        location: Location,
        constructor: string,
        constructorType: string,
        expr: string,
        exprType: string
    }

    export interface DefinitionTypeMismatch {
        kind: 'DefinitionTypeMismatch',
        header: string,
        location: Location
        expected: string,
        expectedType: string,
        actual: string,
        expr: string,
        exprType: string
    }

    // https://github.com/agda/agda/blob/2794f9d84667e6f875d0c6b74bcbae9b1cc507d6/src/full/Agda/TypeChecking/Monad/Base.hs#L2341
    export interface IlltypedPattern {
        kind: 'IlltypedPattern';
        header: string;
        location: Location;
        pattern: string;
        type: string;
    }

    export interface MissingType {
        kind: 'MissingType';
        header: string,
        location: Location;
        expr: string;
        decl: string;
    }

    export interface MultipleDefinition {
        kind: 'MultipleDefinition',
        header: string,
        location: Location,
        locationPrev: Location,
        expr: string,
        decl: string,
        declType: string
    }

    export interface MissingDefinition {
        kind: 'MissingDefinition',
        header: string,
        location: Location,
        expr: string
    }
    export interface RHSOmitted {
        kind: 'RHSOmitted',
        header: string,
        location: Location,
        expr: string,
        exprType: string
    }


    export interface Termination {
        kind: 'Termination',
        header: string,
        location: Location,
        expr: string,
        calls: {
            expr: string,
            location: Location
        }[]
    }

    export interface ConstructorTarget {
        kind: 'ConstructorTarget',
        header: string,
        location: Location,
        expr: string,
        ctor: string,
        decl: string
    }

    export interface FunctionType {
        kind: 'FunctionType',
        header: string,
        location: Location,
        expr: string,
        exprType: string
    }

    export interface ModuleMismatch {
        kind: 'ModuleMismatch',
        header: string,
        wrongPath: string,
        rightPath: string,
        moduleName: string
    }

    export interface Parse {
        kind: 'Parse',
        header: string,
        location: Location
        message: string,
        expr: string,
    }

    export interface CaseSingleHole {
        kind: 'CaseSingleHole',
        header: string,
        location: Location,
        expr: string,
        exprType: string
    }

    export interface PatternMatchOnNonDatatype {
        kind: 'PatternMatchOnNonDatatype',
        header: string,
        location: Location,
        nonDatatype: string,
        expr: string,
        exprType: string
    }

    export interface LibraryNotFound {
        kind: 'LibraryNotFound',
        header: string,
        libraries: {
            name: string,
            agdaLibFilePath: string,
            installedLibraries: {
                name: string,
                path: string
            }[]
        }[]
    }

    export interface UnparsedButLocated {
        kind: 'UnparsedButLocated',
        location: Location,
        header: string,
        input: string,
    }

    export interface Unparsed {
        kind: 'Unparsed',
        header: string,
        input: string,
    }
}

//
// Connection
//

export type ProcessInfo = {
    location: string;
    version?: {
        raw: string;
        sem: string;
    };
};

export type ConnectionInfo = {
    guid: string;
    agda: ProcessInfo;
    languageServer?: ProcessInfo;
}

export type Connection = ConnectionInfo & {
    stream: Duplex;
    queue: {
        resolve: (actions: Agda.Response[]) => void;
        reject: (error?: any) => void;
    }[];
    filepath: string;   // path of the Agda file
}

export {
    Agda,
    Hole,
    Goal,
    Token,
    TokenType,
    // commands
    // CommandKind,
    // Command,
    // view
    View,
    // Errors
    Error
}
