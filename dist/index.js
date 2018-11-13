"use strict";
var cmd_arguments = process.argv.splice(2);
var path = require('path');
var config_path = path.join(__dirname, '../../../../', cmd_arguments[0]);
var config = require(config_path);
var swaggerParserMock = require('./lib/index');
var _a = require('./lib/utils'), isObject = _a.isObject, isArray = _a.isArray, normalizeArray = _a.normalizeArray;
var primitives = require('./lib/primitives');
var fs = require('fs-extra');
var beautify = require('js-beautify').js;
var beautify_opts = {
    indent_size: 2,
};
var config_arr = normalizeArray(config);
config_arr.forEach(function (cfg) {
    cfg.output = path.join(config_path, '../', cfg.output);
    swaggerParserMock(cfg.api).then(function (docs) {
        var file = "";
        cfg.paths.forEach(function (item) {
            var api = docs.paths[item];
            if (api) {
                Object.keys(api).forEach(function (method) {
                    var api_detail = api[method];
                    if (api_detail.parameters) {
                        var group_params_1 = group_parameters(api_detail.parameters);
                        Object.keys(group_params_1).forEach(function (params_in) {
                            var params_schema = genarate_schema_from_parameters(group_params_1[params_in]);
                            // 如果是普通类型, 直接返回, 不创建新的 type
                            if (is_normal_value(isArray(params_schema) ? params_schema[0] : params_schema))
                                return;
                            if (isArray(params_schema)) {
                                params_schema = params_schema[0];
                            }
                            file += create_type(params_schema, genarate_name_from_api({
                                path: item,
                                method: method,
                                type: 'req',
                                params_in: params_in,
                            }));
                        });
                        // 输出一个唯一 req 类型
                        file += "\n                export type " + genarate_name_from_api({
                            path: item,
                            method: method,
                            type: 'req',
                        }) + " = {\n                  " + Object.keys(group_params_1).map(function (params_in) {
                            var params_schema = genarate_schema_from_parameters(group_params_1[params_in]);
                            if (is_normal_value(params_schema)) {
                                return params_in + ":" + primitives[params_schema] + ";";
                            }
                            if (isArray(params_schema) && is_normal_value(params_schema[0])) {
                                return params_in + ":" + primitives[params_schema] + "[];";
                            }
                            return params_in + ":" + genarate_name_from_api({
                                path: item,
                                method: method,
                                type: 'req',
                                params_in: params_in,
                            });
                        }).join(';\n') + "\n                }\n              ";
                    }
                    if (api_detail.responses) {
                        var res_1 = api_detail.responses;
                        Object.keys(res_1).forEach(function (status) {
                            var status_schema = res_1[status].example ? JSON.parse(res_1[status].example) : {};
                            if (is_normal_value(isArray(status_schema) ? status_schema[0] : status_schema))
                                return;
                            if (isArray(status_schema)) {
                                status_schema = status_schema[0];
                            }
                            // 为什么有人这么无聊在 key 里加冒号???
                            if (Object.keys(status_schema)[0] && Object.keys(status_schema)[0].indexOf(':') !== -1) {
                                file += "\n                    type " + genarate_name_from_api({
                                    path: item,
                                    method: method,
                                    type: 'res',
                                    status: +status,
                                }) + " = {\n                      error_code:" + Object.keys(status_schema).map(function (err_str) {
                                    return "'" + err_str.split(':')[1].trim() + "'";
                                }).join('|') + "\n                    }\n                  ";
                            }
                            else {
                                file += create_type(status_schema, genarate_name_from_api({
                                    path: item,
                                    method: method,
                                    type: 'res',
                                    status: +status,
                                }));
                            }
                        });
                        // 输出一个唯一 res 类型
                        file += "\n                export type " + genarate_name_from_api({
                            path: item,
                            method: method,
                            type: 'res',
                        }) + " = {\n                  " + Object.keys(res_1).map(function (status) {
                            var status_detail = res_1[status];
                            if (status_detail.schema) {
                                if (is_normal_value(status_detail.schema.type)) {
                                    return status + ":" + primitives[status_detail.schema.type] + ";";
                                }
                                if (status_detail.schema.type === 'array' && is_normal_value(status_detail.schema.items.type)) {
                                    return status + ":" + primitives[status_detail.schema.items.type] + "[];";
                                }
                            }
                            return status + ":" + genarate_name_from_api({
                                path: item,
                                method: method,
                                type: 'res',
                                status: +status,
                            }) + (status_detail.schema && status_detail.schema.type === 'array' ? '[]' : '');
                        }).join(';\n') + "\n                }\n              ";
                    }
                });
            }
        });
        fs.outputFile(cfg.output, beautify(file, beautify_opts), {
            encoding: 'utf-8'
        });
    });
});
function is_normal_value(o) {
    if (typeof o !== 'string')
        return false;
    var v = primitives[o];
    return !!v;
}
function group_parameters(params) {
    var params_group = {};
    params.forEach(function (item) {
        if (!params_group[item.in]) {
            params_group[item.in] = [];
        }
        params_group[item.in].push(item);
    });
    return params_group;
}
function genarate_schema_from_parameters(params) {
    var schema = {};
    params.forEach(function (item) {
        if (item.in === 'body' && item.schema) {
            schema = JSON.parse(item.example);
        }
        else {
            schema[item.name] = JSON.parse(item.example);
        }
    });
    return schema;
}
function genarate_name_from_api(api) {
    var path = api.path, method = api.method, type = api.type, params_in = api.params_in, status = api.status;
    path = path
        .replace(/(\/?\{)|\}/g, '__')
        .replace(/\/[a-zA-Z0-9]/g, function (text) {
        return "" + text.charAt(1).toUpperCase();
    })
        .replace(/\/|\-|\./g, '');
    return [path, method, type, params_in, status].join('_');
}
function create_type(obj, name, is_export) {
    if (is_export === void 0) { is_export = false; }
    var str = "\n    " + (is_export ? 'export ' : '') + "type " + name + " = {\n  ";
    if (isArray(obj)) {
        obj = obj[0];
    }
    for (var key in obj) {
        var item = obj[key];
        if (isArray(item)) {
            item = item[0];
        }
        if (isObject(item)) {
            str = create_type(item, name + "_" + key) + str;
            item = name + "_" + key;
        }
        str += "\n      " + key + ":" + item + ",\n    ";
    }
    str += '}';
    return str;
}
