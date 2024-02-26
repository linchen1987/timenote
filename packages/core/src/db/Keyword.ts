import {
  Sequelize,
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

class Keyword extends Model<InferAttributes<Keyword>, InferCreationAttributes<Keyword>> {
  declare id: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare text: string;
  declare postIds?: string[];

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        text: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        postIds: DataTypes.JSON,
      },
      {
        sequelize,
        modelName: 'Keyword',
        tableName: 'Keywords',
      }
    );
  }
}

const createKeyword = (): typeof Keyword => {
  return class extends Keyword {};
};

export { createKeyword };
export { Keyword };

export default createKeyword;
