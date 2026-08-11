'use strict';

const OPERATORS = {
    '+': { precedence: 1, associativity: 'left', apply: (a, b) => a + b },
    '-': { precedence: 1, associativity: 'left', apply: (a, b) => a - b },
    '*': { precedence: 2, associativity: 'left', apply: (a, b) => a * b },
    '/': { precedence: 2, associativity: 'left', apply: (a, b) => {
        if (b === 0) throw new Error('Division by zero is not allowed.');
        return a / b;
    } },
    '%': { precedence: 2, associativity: 'left', apply: (a, b) => {
        if (b === 0) throw new Error('Division by zero is not allowed.');
        return a % b;
    } },
    '^': { precedence: 3, associativity: 'right', apply: (a, b) => a ** b }
};

function tokenize(input) {
    const compact = input.replace(/\s+/g, '');
    if (!compact || compact.length > 120) throw new Error('Enter a math expression of up to 120 characters.');

    const tokens = [];
    let index = 0;
    let expectsValue = true;

    while (index < compact.length) {
        const char = compact[index];
        if (/[0-9.]/.test(char)) {
            const match = compact.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
            if (!match) throw new Error('Invalid number.');
            const value = Number(match[0]);
            if (!Number.isFinite(value)) throw new Error('Invalid number.');
            tokens.push({ type: 'number', value });
            index += match[0].length;
            expectsValue = false;
            continue;
        }
        if (char === '(') {
            if (!expectsValue) throw new Error('Missing operator before "(".');
            tokens.push({ type: 'leftParen' });
            index += 1;
            expectsValue = true;
            continue;
        }
        if (char === ')') {
            if (expectsValue) throw new Error('Missing value before ")".');
            tokens.push({ type: 'rightParen' });
            index += 1;
            expectsValue = false;
            continue;
        }
        if (OPERATORS[char]) {
            if (expectsValue && (char === '+' || char === '-')) {
                tokens.push({ type: 'number', value: 0 });
            } else if (expectsValue) {
                throw new Error(`Unexpected operator "${char}".`);
            }
            tokens.push({ type: 'operator', value: char });
            index += 1;
            expectsValue = true;
            continue;
        }
        throw new Error('Use only numbers, parentheses, and + - * / % ^ operators.');
    }

    if (expectsValue) throw new Error('Expression cannot end with an operator.');
    return tokens;
}

function calculate(expression) {
    const output = [];
    const operators = [];

    for (const token of tokenize(expression)) {
        if (token.type === 'number') {
            output.push(token);
        } else if (token.type === 'operator') {
            const current = OPERATORS[token.value];
            while (operators.length > 0 && operators.at(-1).type === 'operator') {
                const previous = OPERATORS[operators.at(-1).value];
                const shouldPop = previous.precedence > current.precedence ||
                    (previous.precedence === current.precedence && current.associativity === 'left');
                if (!shouldPop) break;
                output.push(operators.pop());
            }
            operators.push(token);
        } else if (token.type === 'leftParen') {
            operators.push(token);
        } else {
            while (operators.length > 0 && operators.at(-1).type !== 'leftParen') output.push(operators.pop());
            if (operators.at(-1)?.type !== 'leftParen') throw new Error('Unmatched closing parenthesis.');
            operators.pop();
        }
    }

    while (operators.length > 0) {
        const token = operators.pop();
        if (token.type === 'leftParen') throw new Error('Unmatched opening parenthesis.');
        output.push(token);
    }

    const values = [];
    for (const token of output) {
        if (token.type === 'number') {
            values.push(token.value);
        } else {
            const right = values.pop();
            const left = values.pop();
            if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error('Invalid expression.');
            const result = OPERATORS[token.value].apply(left, right);
            if (!Number.isFinite(result)) throw new Error('Result is not a finite number.');
            values.push(result);
        }
    }

    if (values.length !== 1) throw new Error('Invalid expression.');
    return values[0];
}

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

module.exports = {
    name: 'calc',
    aliases: ['calculate', 'math', 'calculator', 'compute'],
    description: 'Safely calculate an arithmetic expression.',
    category: 'utility',
    execute: async (sock, msg, args, ctx) => {
        const expression = args.join(' ').trim();
        if (!expression) {
            return reply(sock, msg, ctx, `Usage: ${ctx.prefix}calc <expression>\nExample: ${ctx.prefix}calc (25 * 4 + 10) / 2`);
        }
        try {
            const result = calculate(expression);
            return reply(sock, msg, ctx, `Calculator\nExpression: ${expression}\nResult: ${Number.isInteger(result) ? result : Number(result.toPrecision(12))}`);
        } catch (error) {
            return reply(sock, msg, ctx, `Calculator error: ${error.message}`);
        }
    },
    calculate
};
