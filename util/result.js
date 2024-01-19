
/**
 * Function wrapping the error
 * @param  {...any} args
 */
function die(...args) {
    throw new Error(...args);
}

/**
 * Class representing a Rust-like Result structure
 * @template V,E
 */
class Result {
    /**
     * Shouldn't be called as it makes no value result
     * @private
     */
    constructor() {
        /** @private */
        this.is_err = false;
        /** @type {V} */
        this.value = undefined;
        /** @type {E} */
        this.error = undefined;
    }
    is_error() {
        return this.is_err;
    }

    is_present() {
        return !this.is_err;
    }

    unwrap() {
        if(this.is_err) die('[Result]: ' + this.error);
        return this.value;
    }

    get err() {
        if(!this.is_err) die('[Result]: Error doesn\'t exist in a result');
        return this.error;
    }

    /**
     * Function constructing a result class with a value
     * @template V, E
     * @param {V} value 
     * @returns {Result<V, E>}
     */

    static Ok(value) {
        const result = new Result();
        result.value = value;
        return result;
    }

    /**
     * Function constructing a result class with an error
     * @template V, E
     * @param {E} error 
     * @returns {Result<V, E>}
     */

    static Err(error) {
        const result = new Result();
        result.error = error;
        result.is_err = true;
        return result;
    }
}

module.exports = Result;