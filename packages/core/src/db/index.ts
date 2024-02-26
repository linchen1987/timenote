import { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import CreatePost from './Post';
import CreateKeyword from './Keyword';
import CreateKeyMenu, { createMenu } from './Menu';

function doSchemaMigration(sequelize: Sequelize) {
  const umzug = new Umzug({
    migrations: {
      glob: ['migrations/*.js', { cwd: __dirname }],
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });
  return umzug.up();
}

export const init = async (options: { path: string; mode?: 'script' }) => {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: options.path,
  });

  const Post = CreatePost();
  Post.initialize(sequelize, options.mode);
  const Menu = createMenu();
  Menu.initialize(sequelize);
  const Keyword = CreateKeyword();
  Keyword.initialize(sequelize);

  await sequelize.sync();

  await doSchemaMigration(sequelize);

  return {
    Post,
    Menu,
    Keyword,
  };
};

export default init;

export type DB = Awaited<ReturnType<typeof init>>;
