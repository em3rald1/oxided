class CodeBlock {
    /**
     * @param {string} label
     */
    constructor(label) {
        this.label = label;
        this.headers = '';
        this.code = '';
        this.footers = '';
    }

    toString() {
        return `${this.label ? `.${this.label}\n` : ''}${this.headers}${this.code}${this.footers}`;
    }
}

module.exports = CodeBlock;