import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useImmer } from 'use-immer';
import { styled } from '@mui/material/styles';
import debounce from 'lodash/debounce';

import Box from '@mui/material/Box';
import { EditorState, LexicalEditor } from 'lexical';

import Editor from '../editor';
import { formatDateTime } from '../utils';
import { useSpace } from '../contexts/spaces';
import api from '../utils/api';
import LayoutHeader from '../components/LayoutHeader';

type Post = {
  id: string;
  content: string;
  editable: boolean;
  createdAt: string;
  updatedAt: string;
};

function Dot() {
  return <Box className="mr-1 w-1.5 h-1.5 rounded-full bg-orange-400" />;
}

export default function Post() {
  const editorRef = useRef<LexicalEditor>();
  const [post, setPost] = useImmer<Post | null>(null);
  const { space, menu, menuId } = useSpace();
  const { pid } = useParams<{ pid: string }>();
  const [updating, setUpdating] = useState(false);

  const title = menu?.findNode(menuId || '')?.title || 'Note';

  const spaceId = space?.id;

  const getPost = () =>
    api
      .get(`/api/v1/s/${spaceId}/post/${pid}`)
      .then((res) => {
        const data = res.data?.post;
        setPost(data);
      })
      .catch((err) => {
        console.error(err);
      });

  useEffect(() => {
    if (spaceId && pid) {
      getPost();
    }
  }, [space?.id, pid]);

  const onUpdate = useCallback(async () => {
    try {
      const content = JSON.stringify(editorRef.current!.getEditorState());
      await api.post(`/api/v1/s/${spaceId}/updatePost/${post!.id}`, {
        content,
      });
      setUpdating(false);

      // update updatedAt
      api
        .get(`/api/v1/s/${spaceId}/post/${pid}`)
        .then((res) => {
          const data = res.data?.post;
          setPost((x) => {
            x!.updatedAt = data.updatedAt;
          });
        })
        .catch((err) => {
          console.error(err);
        });
    } catch (error) {
      setUpdating(false);
      console.error(error);
    }
  }, [post]);

  // 防抖，2秒后保存
  const handleChange = useCallback(
    debounce(() => {
      onUpdate();
    }, 2000),
    [onUpdate]
  );

  const onChange = useCallback(
    (editorState: EditorState) => {
      const content = JSON.stringify(editorState);
      if (content !== post?.content) {
        setUpdating(true);
        handleChange();
      }
    },
    [post?.content]
  );

  return (
    <Wrapper>
      <Box className="">
        <LayoutHeader title={title}>
          {post && (
            <Box className="post-header">
              {updating ? <Dot /> : 'Edited'} {formatDateTime(post.updatedAt)}
            </Box>
          )}
        </LayoutHeader>
      </Box>
      {post && (
        <Box className="flex-1 overflow-hidden">
          <Editor
            editable
            editorRef={editorRef}
            height="100%"
            onChange={onChange}
            editorState={post.content}
            className="editor-card"
          />
        </Box>
      )}
    </Wrapper>
  );
}

const Wrapper = styled(Box)(
  ({ theme }) => `
  height: 100%;
  display: flex;
  flex-direction: column;
  .post-header {
    display: flex;
    align-items: center;
    font-size: 12px;
    color: ${theme.vars.palette.text.secondary};
    font-weight: 400;
    align-self: flex-end;
  }
  .editor-card {
    background-color: #fbfbfb;
    ${theme.getColorSchemeSelector('dark')} {
      background-color: ${theme.vars.palette.grey[900]};
    }
    border-radius: 8px;
    padding: 8px 16px;
  }

  .tag {
    margin-right: 8px;
  }
`
);
