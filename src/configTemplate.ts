export const configTemplate = `
module.exports = {
    output:'', //不使用命令行需要填写
    projects:[
        {
            title:'测试',  //项目名称,用于生成目录 
            path:'https://petstore.swagger.io/v2/swagger.json'  //接口文档url
        }
    ]
}
`;
