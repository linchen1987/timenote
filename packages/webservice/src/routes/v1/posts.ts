import path from 'path';
import fs from 'fs-extra';
import type { Request, Response } from '../../types';

const parseQuery = ({
  offset,
  limit,
  q,
  sort_field,
  menu_id,
}: {
  offset?: string;
  limit?: string;
  q?: string;
  sort_field?: 'created_at' | 'updated_at';
  menu_id?: string;
}) => {
  const sortField: 'createdAt' | 'updatedAt' =
    sort_field === 'created_at' ? 'createdAt' : 'updatedAt';
  return {
    offset: parseInt(String(offset)) || 0,
    limit: parseInt(String(limit)) || 20,
    query: q,
    sortField,
    menuId: menu_id,
  };
};

const getPosts = async (req: Request, res: Response) => {
  const { space } = req;
  const { offset, limit, sortField, menuId, query } = parseQuery(req.query);

  const { list, count } = await space!.getPosts({
    offset,
    limit,
    sortField,
    query,
    menuId,
  });
  res.json({ posts: list, total: count, hasMore: offset + limit < count });
};

const getPost = async (req: Request, res: Response) => {
  const { space } = req;
  const id = req.params.id;
  const post = await space!.getPost({ id });
  res.json({ post });
};

const createPost = async (req: Request, res: Response) => {
  const { space } = req;
  await space!.createPost({ content: req.body.content });
  res.json({});
};

const updatePost = async (req: Request, res: Response) => {
  const { space } = req;
  const { id } = req.params;
  await space!.updatePost({ id, content: req.body.content });
  res.json({ updated: { id: req.params.id } });
};

const deletePost = async (req: Request, res: Response) => {
  const { space } = req;
  const { id } = req.params;
  await space!.deletePost({ id });
  res.json({ deleted: { id: req.params.id } });
};

export { getPosts, getPost, createPost, updatePost, deletePost };
