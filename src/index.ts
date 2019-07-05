import * as b from "@babel/core";
import { TraverseOptions } from "@babel/traverse";

interface State {}

interface Options {
    styledIdentifiers?: string[];
    addAttributePrefix?: string;
}

const defaultOptions: Options = {
    styledIdentifiers: ["styled"],
    addAttributePrefix: "",
};

function getMostLeftMemberIdentifier(exp: b.types.MemberExpression, t: typeof b.types): string | undefined {
    if (t.isMemberExpression(exp.object)) {
        return getMostLeftMemberIdentifier(exp.object, t);
    }
    if (t.isIdentifier(exp.object)) {
        return exp.object.name;
    }
    if (t.isThisExpression(exp.object)) {
        return "this";
    }
    return undefined;
}

function isStyled(t: typeof b.types, exp: b.types.Expression, styledNames: string[]): boolean {
    if (t.isIdentifier(exp)) {
        return styledNames.includes(exp.name);
    }
    if (t.isMemberExpression(exp)) {
        if (t.isCallExpression(exp.object)) {
            return isStyled(t, exp.object, styledNames);
        }
        const mostLeftIdentifier = getMostLeftMemberIdentifier(exp, t);
        if (mostLeftIdentifier && styledNames.includes(mostLeftIdentifier)) {
            return true;
        }
    }
    if (t.isCallExpression(exp)) {
        return isStyled(t, exp.callee, styledNames);
    }
    return false;
}

function shouldProcess(t: typeof b.types, exp: b.NodePath<b.types.Node>): boolean {
    if (!exp.parentPath) {
        return false;
    }
    if (exp.parentPath.isFunctionDeclaration() || exp.parentPath.isClassMethod() || exp.parentPath.isArrowFunctionExpression()) {
        return true;
    }
    return shouldProcess(t, exp.parentPath);
}

function getOuterScope(exp: b.NodePath): b.NodePath {
    if (exp.parentPath.isProgram()) {
        return exp;
    }
    return getOuterScope(exp.parentPath);
}

function getVariableDeclarationForStyled(exp: b.NodePath<b.types.TaggedTemplateExpression>): b.NodePath<b.types.VariableDeclaration> | undefined {
    if (exp.parentPath.isVariableDeclarator() && exp.parentPath.parentPath.isVariableDeclaration()) {
        return exp.parentPath.parentPath;
    }
}

function getStyledIdentifier(exp: b.NodePath<b.types.TaggedTemplateExpression>, t: typeof b.types): string | undefined {
    if (exp.parentPath.isVariableDeclarator() && t.isIdentifier(exp.parentPath.node.id)) {
        return exp.parentPath.node.id.name;
    }
    return;
}

interface ProcessingState {
    attributes: b.types.JSXAttribute[];
    names: string[];
    attributePrefix?: string;
}

function processTemplateIdentifierExpression(
    exp: b.types.Identifier,
    scope: b.NodePath["scope"],
    accessIdentifier: string,
    state: ProcessingState,
    t: typeof b.types,
): b.types.Expression | undefined {
    if (!scope.hasOwnBinding(exp.name)) {
        return undefined;
    }
    if (!state.names.includes(exp.name)) {
        state.attributes.push(t.jsxAttribute(t.jsxIdentifier(state.attributePrefix ? state.attributePrefix + exp.name : exp.name), t.jsxExpressionContainer(exp)));
        state.names.push(exp.name);
    }
    return t.memberExpression(t.identifier(accessIdentifier), state.attributePrefix ? t.identifier(state.attributePrefix + exp.name) : exp);
}

function processTemplateMemberExpression(
    exp: b.types.MemberExpression,
    scope: b.NodePath["scope"],
    accessIdentifier: string,
    excludeIdentifier: string = "",
    state: ProcessingState,
    t: typeof b.types,
): b.types.Expression | undefined {
    if (!t.isIdentifier(exp.property)) {
        return;
    }
    const mostLeftIdentifier = getMostLeftMemberIdentifier(exp, t);
    if (!mostLeftIdentifier) {
        return;
    }
    if (mostLeftIdentifier !== "this" && !scope.hasOwnBinding(mostLeftIdentifier)) {
        return;
    }
    if (excludeIdentifier && mostLeftIdentifier === excludeIdentifier) {
        return;
    }
    if (!state.names.includes(exp.property.name)) {
        state.attributes.push(t.jsxAttribute(t.jsxIdentifier(state.attributePrefix ? state.attributePrefix + exp.property.name : exp.property.name), t.jsxExpressionContainer(exp)));
        state.names.push(exp.property.name);
    }
    return t.memberExpression(t.identifier(accessIdentifier), state.attributePrefix ? t.identifier(state.attributePrefix + exp.property.name) : exp.property);
}

function processInnerExpression(
    exp: b.types.Expression,
    scope: b.NodePath["scope"],
    accessIdentifier: string,
    excludeIdentifier: string = "",
    state: ProcessingState,
    t: typeof b.types,
): b.types.Expression {
    if (t.isIdentifier(exp)) {
        return processTemplateIdentifierExpression(exp, scope, accessIdentifier, state, t) || exp;
    } else if (t.isMemberExpression(exp)) {
        return processTemplateMemberExpression(exp, scope, accessIdentifier, excludeIdentifier, state, t) || exp;
    } else if (t.isLogicalExpression(exp) || t.isBinaryExpression(exp)) {
        return processTemplateLogicalExpression(exp, scope, accessIdentifier, excludeIdentifier, state, t) || exp;
    } else if (t.isConditionalExpression(exp)) {
        return processTemplateConditionalExpression(exp, scope, accessIdentifier, excludeIdentifier, state, t) || exp;
    } else if (t.isUnaryExpression(exp)) {
        exp.argument = processInnerExpression(exp.argument, scope, accessIdentifier, excludeIdentifier, state, t) || exp;
        return exp;
    } else if (t.isTaggedTemplateExpression(exp)) {
        return processInnerTaggedTemplateExpression(exp, scope, accessIdentifier, excludeIdentifier, state, t) || exp;
    } else if (t.isTSNonNullExpression(exp)) {
        exp.expression = processInnerExpression(exp.expression, scope, accessIdentifier, excludeIdentifier, state, t) || exp;
    }
    return exp;
}

function processInnerTaggedTemplateExpression(
    exp: b.types.TaggedTemplateExpression,
    scope: b.NodePath["scope"],
    accessIdentifier: string,
    excludeIdentifier: string = "",
    state: ProcessingState,
    t: typeof b.types,
): b.types.Expression | undefined {
    for (let i = 0; i < exp.quasi.expressions.length; i++) {
        const e = exp.quasi.expressions[i];
        exp.quasi.expressions[i] = processInnerExpression(e, scope, accessIdentifier, excludeIdentifier, state, t);
    }
    return exp;
}

function processTemplateLogicalExpression(
    exp: b.types.LogicalExpression | b.types.BinaryExpression,
    scope: b.NodePath["scope"],
    accessIdentifier: string,
    excludeIdentifier: string = "",
    state: ProcessingState,
    t: typeof b.types,
): b.types.Expression | undefined {
    exp.left = processInnerExpression(exp.left, scope, accessIdentifier, excludeIdentifier, state, t);
    exp.right = processInnerExpression(exp.right, scope, accessIdentifier, excludeIdentifier, state, t);
    return exp;
}

function processTemplateConditionalExpression(
    exp: b.types.ConditionalExpression,
    scope: b.NodePath["scope"],
    accessIdentifier: string,
    excludeIdentifier: string = "",
    state: ProcessingState,
    t: typeof b.types,
): b.types.Expression | undefined {
    exp.test = processInnerExpression(exp.test, scope, accessIdentifier, excludeIdentifier, state, t);
    exp.consequent = processInnerExpression(exp.consequent, scope, accessIdentifier, excludeIdentifier, state, t);
    exp.alternate = processInnerExpression(exp.alternate, scope, accessIdentifier, excludeIdentifier, state, t);
    return exp;
}

function processTemplateArrowFunctionExpression(
    exp: b.types.ArrowFunctionExpression,
    scope: b.NodePath["scope"],
    accessIdentifier: string,
    excludeIdentifier: string = "",
    state: ProcessingState,
    t: typeof b.types,
): b.types.Expression | undefined {
    if (!t.isExpression(exp.body)) {
        return;
    }
    return processInnerExpression(exp.body, scope, accessIdentifier, excludeIdentifier, state, t);
}

interface JSXVisitorState {
    elementIdentifier: string;
    attributes: b.types.JSXAttribute[];
}

const jsxVisitor: TraverseOptions<JSXVisitorState> = {
    JSXOpeningElement(path, state) {
        if (path.node.name.type !== "JSXIdentifier" || path.node.name.name !== state.elementIdentifier) {
            return;
        }
        path.node.attributes.push(...state.attributes);
    }
}

export default function plugin({ types: t }: typeof b, options: Options = {}): b.PluginObj<State> {
    const finalOptions = {
        ...defaultOptions,
        ...options,
    }
    return {
        visitor: {
            TaggedTemplateExpression(path) {
                if (!isStyled(t, path.node.tag, finalOptions.styledIdentifiers!)) {
                    return;
                }
                if (!shouldProcess(t, path)) {
                    return;
                }

                const declaration = getVariableDeclarationForStyled(path);
                if (!declaration) {
                    return;
                }
                const styledIdentifier = getStyledIdentifier(path, t);
                if (!styledIdentifier) {
                    return;
                }
                // rewrite expressions if it refers to scope
                const processingState: ProcessingState = {
                    attributes: [],
                    names: [],
                    attributePrefix: finalOptions.addAttributePrefix!,
                };
                for (let i = 0; i < path.node.quasi.expressions.length; i++) {
                    let exp = path.node.quasi.expressions[i];
                    // drop TS a! thing
                    if (t.isTSNonNullExpression(exp)) {
                        exp = exp.expression;
                    }
                    let processed: b.types.Expression | undefined;
                    let paramName = "p";
                    if (t.isIdentifier(exp)) {
                        processed = processTemplateIdentifierExpression(exp, path.scope, paramName, processingState, t);
                    } else if (t.isMemberExpression(exp)) {
                        processed = processTemplateMemberExpression(exp, path.scope, paramName, "", processingState, t);
                    } else if (t.isLogicalExpression(exp)) {
                        processed = processTemplateLogicalExpression(exp, path.scope, paramName, "", processingState, t);
                    } else if (t.isConditionalExpression(exp)) {
                        processed = processTemplateConditionalExpression(exp, path.scope, paramName, "", processingState, t);
                    } else if (t.isArrowFunctionExpression(exp)) {
                        if (exp.params.length > 1) {
                            continue;
                        }
                        const paramIdentifier = exp.params[0] && t.isIdentifier(exp.params[0]) ? (exp.params[0] as b.types.Identifier).name : undefined;
                        // don't support destructuring in params
                        if (paramIdentifier) {
                            paramName = paramIdentifier;
                        }
                        processed = processTemplateArrowFunctionExpression(exp, path.scope, paramName, paramIdentifier, processingState, t);
                    }
                    if (processed) {
                        path.node.quasi.expressions[i] = t.arrowFunctionExpression(
                            [
                                t.identifier(paramName)
                            ],
                            processed,
                        );
                    }
                }
                if (processingState.attributes.length) {
                    const styledScope = path.scope.path;
                    styledScope.traverse(jsxVisitor, {
                        elementIdentifier: styledIdentifier,
                        attributes: processingState.attributes,
                    });
                }

                // move to outer scope
                const outerScope = getOuterScope(path);
                outerScope.insertBefore([declaration.node]);
                declaration.remove();
            }
        },
    }
}