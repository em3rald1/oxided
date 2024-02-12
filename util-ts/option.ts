export interface Option<T> {
    map<U>(fn: (v: T) => U): Option<U>;
    is_some(): boolean;
    is_none(): boolean;
    unwrap(): T;
}

export class Some<T> implements Option<T> {
    private value: T;

    constructor(v: T) {
        this.value = v;
    }

    map<U>(fn: (v: T) => U): Option<U> {
        return new Some(fn(this.value));
    }

    is_some(): boolean {
        return true;
    }

    is_none(): boolean {
        return false;
    }

    unwrap(): T { 
        return this.value;
    }
}

export class None<T> implements Option<T> {
    constructor() {}

    map<U>(fn: (v: T) => U): Option<U> {
        return <Option<U>>None._instance;
    }

    is_some() {
        return false;
    }

    is_none() {
        return true;
    }

    unwrap(): T {
        console.log("None.unwrap()");
        throw new Error("None.get");
    }

    private static _instance: Option<any> = new None();

    public static instance<X>(): Option<X> {
        return <Option<X>> None._instance;
    }
}