// General JSON Typing

export type JSONValueType =
    | null
    | string
    | number
    | boolean
    | { [x: string]: JSONValueType }
    | Array<JSONValueType>
