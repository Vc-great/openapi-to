import { Command } from 'commander'
import chalk from 'chalk'
import packageJson from '../package.json'
import { createCode, createFile } from '../lib/create'

const program = new Command()

program
    .name('yapi')
    .description('根据yapi接口文档生成api请求')
    .usage('<command>')
    .version(packageJson.version, '-v, --version', '版本号')

program
    .command('init')
    .description('初始化,生成配置文件')
    .action(source => {
        createFile()
    })
program
    .command('install')
    .description('生成代码')
    .action(source => {
        createCode()
    })
program
    .command('i')
    .description('生成代码（简写形式）')
    .action(source => {
        createCode()
    })

program.on('--help', () => {
    console.log()
    console.log(`  Run ${chalk.yellow(`yapi <command> --help`)} for detailed usage of given command.`)
    console.log()
})

program.parse(process.argv)
