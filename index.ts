const cmd_arguments = process.argv.splice(2);
const config = require(cmd_arguments[0]);

const swaggerParserMock = require('./lib/index');
const {
  isObject,
  isArray,
  normalizeArray,
} = require('./lib/utils');
const primitives = require('./lib/primitives');
const fs = require('fs-extra');
const beautify = require('js-beautify').js;
const beautify_opts = {
  indent_size: 2,
};

type ParamsIn = 'header' | 'query' | 'path' | 'body';

type SwaggerParamseters = {
  in: ParamsIn,
  name: string,
  type?: 'integer' | 'string',
  schema?: any,
  example?: any,
};
const config_arr = normalizeArray(config);

config_arr.forEach((cfg: any) => {
  swaggerParserMock(cfg.api).then((docs: any) => {
    let file = ``;
    cfg.paths.forEach((item: string) => {
      const api = docs.paths[item];
      if (api) {
        Object.keys(api).forEach((method) => {
          const api_detail = api[method];
          if (api_detail.parameters) {
            const group_params = group_parameters(api_detail.parameters);
            Object.keys(group_params).forEach((params_in) => {
              let params_schema = genarate_schema_from_parameters(
                group_params[params_in],
              );

              // 如果是普通类型, 直接返回, 不创建新的 type
              if (is_normal_value(isArray(params_schema) ? params_schema[0] : params_schema)) return;
              if (isArray(params_schema)) {
                params_schema = params_schema[0];
              }
              file += create_type(
                params_schema,
                genarate_name_from_api({
                  path: item,
                  method,
                  type: 'req',
                  params_in: params_in as ParamsIn,
                }),
              );
            })

            // 输出一个唯一 req 类型
            file += `
                export type ${genarate_name_from_api({
                path: item,
                method,
                type: 'req',
              })} = {
                  ${Object.keys(group_params).map((params_in) => {
                let params_schema = genarate_schema_from_parameters(
                  group_params[params_in],
                );
                if (is_normal_value(params_schema)) {
                  return `${params_in}:${primitives[params_schema]};`;
                }
                if (isArray(params_schema) && is_normal_value(params_schema[0])) {
                  return `${params_in}:${primitives[params_schema]}[];`;
                }
                return `${params_in}:${genarate_name_from_api({
                  path: item,
                  method,
                  type: 'req',
                  params_in: params_in as ParamsIn,
                })}`
              }).join(';\n')}
                }
              `
          }

          if (api_detail.responses) {
            const res = api_detail.responses;
            Object.keys(res).forEach((status) => {
              let status_schema = res[status].example ? JSON.parse(res[status].example) : {};

              if (is_normal_value(isArray(status_schema) ? status_schema[0] : status_schema)) return;

              if (isArray(status_schema)) {
                status_schema = status_schema[0];
              }

              // 为什么有人这么无聊在 key 里加冒号???
              if (Object.keys(status_schema)[0] && Object.keys(status_schema)[0].indexOf(':') !== -1) {
                file += `
                    type ${genarate_name_from_api({
                    path: item,
                    method,
                    type: 'res',
                    status: +status,
                  })} = {
                      error_code:${Object.keys(status_schema).map((err_str) => {
                    return `'${err_str.split(':')[1].trim()}'`;
                  }).join('|')}
                    }
                  `
              } else {
                file += create_type(
                  status_schema,
                  genarate_name_from_api({
                    path: item,
                    method,
                    type: 'res',
                    status: +status,
                  }),
                );
              }
            })

            // 输出一个唯一 res 类型
            file += `
                export type ${genarate_name_from_api({
                path: item,
                method,
                type: 'res',
              })} = {
                  ${Object.keys(res).map((status) => {
                const status_detail = res[status];

                if (status_detail.schema) {

                  if (is_normal_value(status_detail.schema.type)) {
                    return `${status}:${primitives[status_detail.schema.type]};`;
                  }
                  if (status_detail.schema.type === 'array' && is_normal_value(status_detail.schema.items.type)) {
                    return `${status}:${primitives[status_detail.schema.items.type]}[];`;
                  }
                }

                return `${status}:${genarate_name_from_api({
                  path: item,
                  method,
                  type: 'res',
                  status: +status,
                })}${status_detail.schema && status_detail.schema.type === 'array' ? '[]' : ''}`
              }).join(';\n')}
                }
              `
          }
        })
      }
    });
    fs.outputFile(cfg.output, beautify(file, beautify_opts), {
      encoding: 'utf-8'
    });
  });
})

function is_normal_value(o: any): boolean {
  if (typeof o !== 'string') return false;
  const v = primitives[o];

  return !!v;
}

function group_parameters(params: SwaggerParamseters[]) {
  const params_group: any = {};
  params.forEach((item) => {
    if (!params_group[item.in]) {
      params_group[item.in] = [];
    }
    params_group[item.in].push(item);
  });
  return params_group;
}

function genarate_schema_from_parameters(params: SwaggerParamseters[]) {
  let schema: any = {};

  params.forEach((item) => {
    if (item.in === 'body' && item.schema) {
      schema = JSON.parse(item.example)
    } else {
      schema[item.name] = JSON.parse(item.example);
    }
  });

  return schema;
}

function genarate_name_from_api(api: {
  path: string,
  method: string,
  type: 'res' | 'req',
  params_in?: ParamsIn,
  status?: number,
}): string {
  let { path, method, type, params_in, status } = api;
  path = path
    .replace(/(\/?\{)|\}/g, '__')
    .replace(/\/[a-zA-Z0-9]/g, (text) => {
      return `${text.charAt(1).toUpperCase()}`;
    })
    .replace(/\/|\-|\./g, '');

  return [path, method, type, params_in, status].join('_');
}

function create_type(obj: any, name: string, is_export: boolean = false): string {
  let str = `
    ${is_export ? 'export ' : ''}type ${name} = {
  `;
  if (isArray(obj)) {
    obj = obj[0];
  }
  for (const key in obj) {
    let item = obj[key];
    if (isArray(item)) {
      item = item[0];
    }
    if (isObject(item)) {
      str = create_type(item, `${name}_${key}`) + str;
      item = `${name}_${key}`;
    }
    str += `
      ${key}:${item},
    `
  }
  str += '}';
  return str;
}