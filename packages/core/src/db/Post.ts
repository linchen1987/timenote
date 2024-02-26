import {
  Sequelize,
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';
class Post extends Model<InferAttributes<Post>, InferCreationAttributes<Post>> {
  declare id: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare type: 'lexical';
  declare content: string;
  declare title?: string; // just for display, calc by content

  public static initialize(sequelize: Sequelize, mode?: 'script'): void {
    this.init(
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        type: DataTypes.STRING,
        content: DataTypes.STRING,
        title: DataTypes.STRING,
      },
      {
        sequelize,
        modelName: 'Post',
        tableName: 'Posts',
        updatedAt: mode === 'script' ? false : true,
      }
    );
  }
}

const createPost = (): typeof Post => {
  return class extends Post {};
};

export { createPost };
export { Post };

export default createPost;
