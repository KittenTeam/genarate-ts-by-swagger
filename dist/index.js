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
    preserve_newlines: false,
};
var config_arr = normalizeArray(config);
config_arr.forEach(function (cfg) {
    cfg.output = path.join(config_path, '../', cfg.output);
    swaggerParserMock(cfg.api)
        .then(function (docs) {
        var file = "\n      // \u6B64\u6587\u6863\u4E3A\u673A\u5668\u751F\u6210, \u8BF7\u52FF\u4FEE\u6539\n    ";
        Object.keys(cfg.paths).forEach(function (prop) {
            var api_alias = cfg.paths[prop];
            var api = docs.paths[prop];
            if (api) {
                Object.keys(api).forEach(function (method) {
                    var api_detail = api[method];
                    if (!api_detail.parameters &&
                        (!api_detail.responses || !api_detail.responses['200'])) {
                        return;
                    }
                    file += "export namespace " + api_alias + " {";
                    if (api_detail.parameters) {
                        var group_params_1 = group_parameters(api_detail.parameters);
                        Object.keys(group_params_1).forEach(function (params_in) {
                            var params_schema = genarate_schema_from_parameters(group_params_1[params_in]);
                            // 如果是普通类型, 直接返回, 不创建新的 type
                            if (is_normal_value(isArray(params_schema) ? params_schema[0] : params_schema))
                                return;
                            if (isArray(params_schema)) {
                                params_schema = params_schema[0];
                                file += create_type(params_schema, genarate_name_from_api({
                                    path: prop,
                                    type: 'req',
                                    params_in: params_in,
                                    method: method,
                                }));
                                file += "\n                  export type " + params_in + " = " + genarate_name_from_api(api) + "[];\n                ";
                            }
                            else {
                                file += create_type(params_schema, params_in, true);
                            }
                        });
                    }
                    if (api_detail.responses) {
                        var res = api_detail.responses;
                        var status_schema = res['200'].example ? JSON.parse(res['200'].example) : {};
                        if (is_normal_value(isArray(status_schema) ? status_schema[0] : status_schema))
                            return;
                        if (isArray(status_schema)) {
                            status_schema = status_schema[0];
                            var type_name = genarate_name_from_api({
                                path: prop,
                                type: 'res',
                                method: method,
                                status: '200',
                            });
                            file += create_type(status_schema, type_name);
                            file += "\n                export type res = " + type_name + "[];\n              ";
                        }
                        else {
                            file += create_type(status_schema, 'res', true);
                        }
                    }
                    file += "}";
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
function genarate_name_from_api(api) {
    var path = api.path, type = api.type, params_in = api.params_in, status = api.status, method = api.method;
    path = path
        .replace(/(\/?\{)|\}/g, '__')
        .replace(/\/[a-zA-Z0-9]/g, function (text) {
        return text.charAt(1).toUpperCase();
    })
        .replace(/\/|\-|\./g, '');
    return [path, method, type, params_in, status].join('_');
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
        str += "\n      " + key + (name === 'query' ? '?' : '') + ":" + item + ",\n    ";
    }
    str += '}';
    return str;
}
