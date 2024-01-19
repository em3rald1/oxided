/**
 * @template T
 */
class Optional {
    /** @private */
    constructor() {
        this.present = false;
        this.value = undefined;
    }

    static get None() {
        /** @type {Optional<T>} */
        const optional = new Optional();
        return optional;
    }
    /**
     * @param {T} value
     */
    static Some(value) {
        /** @type {Optional<T>} */
        const optional = new Optional();
        optional.present = true;
        optional.value = value;
        return optional;
    }

    is_some() {
        return this.present;
    }

    is_none() {
        return !this.present;
    }
}

module.exports = Optional;