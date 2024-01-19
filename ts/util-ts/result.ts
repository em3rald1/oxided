import { None, Option, Some } from "./option";

export interface Result<T, E> {
    map<U>(fn: (v: T) => U): Result<U, E>;
    map_err<F>(fn: (e: E) => F): Result<T, F>;
    is_ok(): boolean;
    is_err(): boolean;
    unwrap(): T;

    into<X, Y>(): Result<X, Y>;

    get __err(): Option<E>;
}

export class Ok<T, E> implements Result<T, E> {
    private value: T;
    constructor(value: T) {
        this.value = value;
    }

    map<U>(fn: (v: T) => U): Result<U, E> {
        return new Ok<U, E>(fn(this.value));
    }

    map_err<F>(fn: (e: E) => F): Result<T, F> {
        return <Result<T, F>><unknown>this;
    }

    is_ok(): boolean { return true; }
    is_err(): boolean { return false; }
    unwrap(): T { return this.value; }

    into<X, Y>(): Result<X, Y> { return <Result<X, Y>><unknown>this; }

    get __err(): Option<E> { return new None;}
}

export class Err<T, E> implements Result<T, E> {
    private error: E;
    constructor(err: E) {
        this.error = err;
    }

    map<U>(fn: (v: T) => U): Result<U, E> {
        return <Result<U, E>><unknown>this;
    }


    map_err<F>(fn: (e: E) => F): Result<T, F> {
        return new Err<T, F>(fn(this.error));
    }

    is_ok(): boolean { return false; }
    is_err(): boolean { return true; }
    unwrap(): T {
        console.log(this.error);
        throw "Err.unwrap";
    }

    into<X, Y>(): Result<X, Y> { return <Result<X, Y>><unknown>this; }

    get __err(): Option<E> { return new Some(this.error); }
}