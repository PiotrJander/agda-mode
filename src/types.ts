import Goal from "./goal";

type Range = any;

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

namespace Agda {

    // base interface
    export interface Response {
        type: ResponseType
    }

    export const enum ResponseType {
        InfoAction,
        StatusAction,
        GoalsAction,
        GiveAction,
        ParseError,
        Goto,
        SolveAllAction,
        MakeCaseAction,
        MakeCaseActionExtendLam,
        HighlightClear,
        HighlightAddAnnotations,
        HighlightLoadAndDeleteAction,
        UnknownAction
    }

    export interface InfoAction extends Response {
        infoActionType: InfoActionType;
        content: string[];
    }
    export interface StatusAction extends Response {
        content: string[];
    }
    export interface GoalsAction extends Response {
        content: number[];
    }
    export interface GiveAction extends Response {
        index: number;
        content: string;
        hasParenthesis: boolean;
    }

    export interface ParseError extends Response {
        content: string[];
    }

    export interface Goto extends Response {
        filepath: string;
        position: number;
    }
    export interface SolveAllAction extends Response {
        solutions: {
            index: number,
            expression: string
        }[];
    }
    export interface MakeCaseAction extends Response {
        content: string[];
    }
    export interface MakeCaseActionExtendLam extends Response {
        content: string;
    }
    export interface HighlightClear extends Response {
        content: string[];
    }
    export interface HighlightAddAnnotations extends Response {
        content: Annotation[];
    }

    export interface HighlightLoadAndDeleteAction extends Response {
        content: string;
    }
    export interface UnknownAction extends Response {
        content: string[];
    }

    export const enum InfoActionType {
        AllGoals,
        Error,
        TypeChecking,
        CurrentGoal,
        InferredType,
        ModuleContents,
        Context,
        GoalTypeEtc,
        NormalForm,
        Intro,
        Auto,
        Constraints,
        ScopeInfo
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
}

//
//  agda-mode commands
//

// base interface
interface Command {
    type: CommandType;
    normalization?: Normalization;
}

const enum CommandType {
    Load,
    Quit,
    Restart,
    Compile,
    ToggleDisplayOfImplicitArguments,
    Info,
    ShowConstraints,
    SolveConstraints,
    ShowGoals,
    NextGoal,
    PreviousGoal,
    WhyInScope,
    InferType,
    ModuleContents,
    ComputeNormalForm,
    ComputeNormalFormIgnoreAbstract,
    Give,
    Refine,
    Auto,
    Case,
    GoalType,
    Context,
    GoalTypeAndContext,
    GoalTypeAndInferredType,
    InputSymbol
}

type Normalization = "Simplified" | "Instantiated" | "Normalised";
// const enum Normalization {
//     Simplified,
//     Instantiated,
//     Normalised
// }

type Result = Command;

//
//  View
//

namespace View {

    export const enum Type {
        PlainText,
        Error,
        Warning,
        Judgement,
        Value
    }

    export type JudgementForm = "goal" |
        "type judgement" |
        "meta" |
        "term" |
        "sort" ;

    // Occurence & Location
    export interface Location {
        path: string,
        range: Range,
        isSameLine: boolean
    }

    export interface Occurence {
        location: Location,
        body: string
    }

    export interface Header {
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

    export type Item = Goal | Judgement | Term | Meta | Sort;

    export interface Body {
        goal: Goal[],
        judgement: Judgement[],
        term: Term[],
        meta: Meta[],
        sort: Sort[]
    }

    export type BodyError = {
        error: any
    }

    export type BodyUnknown = {
        plainText: any
    }

    // Errors
    export type Error = NotInScopeError |
        TypeMismatch |
        WrongConstructor |
        ApplicationParseError |
        TerminationError |
        MissingDefinition |
        RhsOmitted |
        ParseError |
        Unknown;

    export const enum ErrorType {
        NotInScope,
        TypeMismatch,
        WrongConstructor,
        ApplicationParseError,
        TerminationError,
        MissingDefinition,
        RhsOmitted,
        ParseError,
        Unknown
    }

    export interface NotInScopeError {
        type: ErrorType,
        expr: string,
        location: Location
    }

    export interface TypeMismatch {
        type: ErrorType,
        expected: string,
        expectedType: string,
        actual: string,
        expr: string,
        exprType: string,
        location: Location
    }

    export interface WrongConstructor {
        type: ErrorType,
        constructor: string,
        constructorType: string,
        expr: string,
        exprType: string,
        location: Location
    }

    export interface ApplicationParseError {
        type: ErrorType,
        expr: string,
        location: Location
    }

    export interface TerminationError {
        type: ErrorType,
        expr: string,
        calls: {
            term: string,
            location: Location
        }[],
        location: Location
    }

    export interface MissingDefinition {
        type: ErrorType,
        expr: string,
        location: Location
    }

    export interface RhsOmitted {
        type: ErrorType,
        expr: string,
        exprType: string,
        location: Location
    }

    export interface ParseError {
        type: ErrorType,
        expr: string,
        post: string,
        location: Location
    }

    export interface Unknown {
        type: ErrorType,
        raw: string,
    }


}


export {
    Agda,
    Hole,
    Goal,
    Token,
    TokenType,
    // commands
    Command,
    CommandType,
    Normalization,
    Result,
    // view
    View
}