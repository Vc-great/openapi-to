export const configTemplate = `
module.exports = {
    jsRequest:true,
    tsRequest:true,
    tsInterface:true,
    requestObject:true,
    zod:false,
    zodDecorator:false, // ts request file use zod decorator
    projects:[
        {
            title:'test',  //项目名称,用于生成目录
            path:'https://petstore.swagger.io/v2/swagger.json'  //接口文档url
        }
    ]
}
`;
