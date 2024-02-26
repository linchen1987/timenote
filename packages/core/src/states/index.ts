import ShortUniqueId from 'short-unique-id';
import { Op } from 'sequelize';
import type { FindAndCountOptions } from 'sequelize';
import { MenuItemMatchRule, MatchType } from '@timenote/types';

import initDb from '../db';
import initMenu from './Menu';

const uid = new ShortUniqueId({ length: 10 });
const genId = () => uid.rnd();

const LIMIT = 20;

const init = async (options: { dbPath: string; mode?: 'script' }) => {
  const { dbPath, mode } = options;

  const db = await initDb({
    path: dbPath,
    mode,
  });

  const Posts = {
    createPost: async (data: {
      content?: string;
      createdAt?: string;
      updatedAt?: string;
    }) => {
      const { content, createdAt, updatedAt } = data;
      const params: Parameters<typeof db.Post.create>[0] = {};

      const now = new Date();

      const post = await db.Post.create({
        id: genId(),
        type: 'lexical',
        content: content!,
        createdAt: createdAt ? new Date(createdAt) : undefined,
        updatedAt: updatedAt ? new Date(updatedAt) : undefined,
      });

      // TODO: keyword

      return post;
    },

    getPosts: async ({
      offset,
      limit,
      sortField,
      sortOrder,
      matchType = 'all',
      matchRules,
    }: {
      sortField?: 'createdAt' | 'updatedAt';
      sortOrder?: 'ASC' | 'DESC';
      offset?: number;
      limit?: number;
      matchType?: MatchType;
      matchRules?: MenuItemMatchRule[];
    } = {}) => {
      const order: [string, string] = [sortField || 'updatedAt', sortOrder || 'DESC'];
      const params: FindAndCountOptions = {
        order: [order],
      };
      params.limit = Math.max(limit || 0, LIMIT);
      if (offset) {
        params.offset = offset;
      }

      if (matchType && matchRules?.length) {
        const rootKey = matchType === 'any' ? Op.or : Op.and;
        params.where = {
          [rootKey]: matchRules.map((rule) => {
            if (rule.type === 'keywords') {
              const key = rule.matchType === 'any' ? Op.or : Op.and;
              return {
                [key]: rule.keywords!.map((keyword) => ({
                  content: {
                    [Op.like]: `%"text":"%${keyword.toLowerCase()}%"%`,
                  },
                })),
              };
            }

            // TODO other types

            return {};
          }),
        };
      }

      const { rows, count } = await db.Post.findAndCountAll(params);
      return {
        list: rows.map((post: any) => post.toJSON()),
        count,
      };
    },

    getPost: async (id: string) => {
      const post = await db.Post.findOne({ where: { id } });
      return post;
    },
    updatePost: async (data: { id: string; content?: string }) => {
      const { id, content } = data;
      const post = await db.Post.findOne({ where: { id } });
      if (!post) {
        throw new Error('Post not found');
      }

      // TODO: keyword

      await post.update({ content });

      return post;
    },
    deletePost: async (id: string) => {
      const post = await db.Post.findOne({ where: { id } });
      if (!post) {
        throw new Error('Post not found');
      }

      await post.destroy();

      // TODO: keyword

      return post;
    },
  };

  const Keywords = {
    createKeyword: async (data: { text: string }) => {
      const { text } = data;
      const keyword = await db.Keyword.create({
        text,
      });

      return keyword;
    },
    getKeywords: async () => {
      const keywords = await db.Keyword.findAll({ order: [['createdAt', 'DESC']] });
      return keywords.map((keyword: any) => keyword.toJSON());
    },
    getKeyword: async (text: string) => {
      const keyword = await db.Keyword.findOne({ where: { text } });
      return keyword;
    },
    updateKeyword: async (data: { text: string; id?: string }) => {
      const { id, text } = data;
      const keyword = await db.Keyword.findOne({ where: { id: Number(id) } });
      if (!keyword) {
        throw new Error('Keyword not found');
      }

      await keyword.update({ text });

      return keyword;
    },
    deleteKeyword: async (id: string) => {
      const keyword = await db.Keyword.findOne({ where: { id: Number(id) } });
      if (!keyword) {
        throw new Error('Keyword not found');
      }

      await keyword.destroy();

      return keyword;
    },
  };

  const Menus = initMenu({ db });

  return {
    Posts,
    Keywords,
    Menus,
  };
};

export type States = Awaited<ReturnType<typeof init>>;

export default init;
