class BaseError extends Error {
    constructor(message, code, props) {
        super(message);

        Object.assign(this, {
            ...props,
            code,
            name: this.constructor.name,
        });

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(message)).stack;
        }
    }
}

export class PromptClosedError extends BaseError {
    constructor() {
        super('The prompt window was closed', 'PROMPT_CLOSED');
    }
}

export class PromptDeniedError extends BaseError {
    constructor(message) {
        super(message, 'PROMPT_DENIED');
    }
}

export class OriginMismatchError extends BaseError {
    constructor(actual, expected) {
        super(`Origin mismatch, got "${actual}" but expected ${expected}`, 'ORIGIN_MISMATCH');
    }
}

export class NoParentWindowError extends BaseError {
    constructor() {
        super('No parent window found (parent/opener)', 'NO_PARENT_WINDOW');
    }
}

export class MissingHookError extends BaseError {
    constructor(name) {
        super(`The ${name} hook is not configured`, 'MISSING_HOOK');
    }
}
