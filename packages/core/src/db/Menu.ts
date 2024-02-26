import {
  Sequelize,
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';

import type { MenuItemConfig } from '@timenote/types';

class Menu extends Model<InferAttributes<Menu>, InferCreationAttributes<Menu>> {
  declare id: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare name: string;
  declare icon: CreationOptional<string>;
  declare order: CreationOptional<number>;
  declare parentId: CreationOptional<string>;
  declare type: 'post' | 'list';
  declare config: MenuItemConfig;

  public static initialize(sequelize: Sequelize): void {
    this.init(
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
        name: DataTypes.STRING,
        icon: DataTypes.STRING,
        order: DataTypes.REAL,
        parentId: DataTypes.STRING,
        type: DataTypes.STRING,
        config: DataTypes.JSON,
      },
      {
        sequelize,
        modelName: 'Menu',
        tableName: 'Menus',
      }
    );
  }
}

const createMenu = (): typeof Menu => {
  return class extends Menu {};
};

export { createMenu };
export { Menu };

export default createMenu;
