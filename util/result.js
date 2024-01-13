
/**
 * 
 * @param  {...any} args
 * @returns {never} 
 */
function die(...args) {
    console.log(...args);
    process.exit(0);
}

/**
 * @template V,E
 */
class Result {
    constructor() {
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