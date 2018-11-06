"use strict";
function isObject(obj) {
    return !!obj && typeof obj === 'object';
}
function objectify(thing) {
    if (!isObject(thing))
        return {};
    return thing;
}
function normalizeArray(arr) {
    if (Array.isArray(arr))
        return arr;
    return [arr];
}
function isFunc(thing) {
    return typeof (thing) === 'function';
}
function inferSchema(thing) {
    if (thing.schema) {
        thing = thing.schema;
    }
    if (thing.properties) {
        thing.type = 'object';
    }
    return thing;
}
function isArray(obj) {
    return Array.isArray(obj);
}
module.exports = {
    isObject: isObject,
    objectify: objectify,
    isFunc: isFunc,
    inferSchema: inferSchema,
    normalizeArray: normalizeArray,
    isArray: isArray,
};
