const { Type } = require("./type");
const Function = require("./function");
const AST = require("../parser/ast");
const lodash = require("lodash");

class State {
    constructor() {
        /** @type {Map<string, Type>} */
        this.types = new Map();
        /** @type {Map<string, Function>} */
        this.functions = new Map();
    }

    /**
     * @param {AST.TypeExpression} typeExpression
     * @returns {Type}
     */
    type_get(typeExpression) {
        const type = lodash.cloneDeep(this.types.get(typeExpression.name));
        if(typeExpression instanceof AST.PointerTypeExpression) {
            type.pointers += typeExpression.pointers;
        }
        type.lifetime = typeExpression.lifetime;
        return type;
    }
}

module.exports = State;