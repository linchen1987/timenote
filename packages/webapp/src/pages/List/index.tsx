import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useImmer } from 'use-immer';
import { styled } from '@mui/material/styles';
import { useIntersection } from 'react-use';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Fullscreen from '@mui/icons-material/Fullscreen';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import { LexicalEditor, $getRoot, $createParagraphNode, $createTextNode } from 'lexical';

import Editor from '../../editor';
import EditUtil from '../../editor/utils';
import LayoutHeader from '../../components/LayoutHeader';
import { useSpace } from '../../contexts/spaces';
import api from '../../utils/api';
import ListItem from './Item';
import SendButton from './SendButton';
import type { Post } from './types';

export default function List() {
  const { menu, menus } = useSpace();
  const creatingEditorRef = useRef<LexicalEditor>();
  const [editingOriginState, setEditingOriginState] = useState<string>();
  const [fullScreen, setFullScreen] = useState(false);
  const [list, setList] = useImmer<Post[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [, setTotal] = useState(0);
  const { space } = useSpace();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { q } = Object.fromEntries(searchParams.entries());
  const intersectionRef = useRef(null);
  const intersection = useIntersection(intersectionRef, {
    root: null,
    rootMargin: '0px',
    threshold: 1,
  });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // menu info
  const { menuId } = useParams();
  const menuItem = menuId ? menu?.findNode(menuId || '') : null;
  const menuItem2 = menuId ? menus?.find((x) => x.id === menuId) : null;
  const title = menuItem?.title || 'ALL';
  const menuContext = {
    searchText: menuItem2?.searchText,
  };

  const [keyword, setKeyword] = useState(q || '');

  const spaceId = space?.id;

  const toggleFullScreen = () => {
    setFullScreen((x) => !x);
  };

  const getLists = useCallback(
    ({ refresh = false } = {}) => {
      setLoading(true);
      api
        .get(`/api/v1/s/${spaceId}/posts`, {
          params: {
            offset: refresh ? 0 : offset,
            q,
            menu_id: menuId,
          },
        })
        .then((res) => {
          const _list = res.data?.posts || [];
          const { hasMore, total = 0 } = res.data || {};
          _list.forEach((post: Post) => {
            post.editable = false;
          });
          if (refresh) {
            setList(_list);
            setOffset(_list.length);
          } else {
            setList((draft) => {
              draft.push(..._list);
            });
            setOffset((x) => x + _list.length);
          }
          setHasMore(!!hasMore);
          setTotal(total);
          setTimeout(
            () => {
              setLoading(false);
            },
            // wait posts be rendered to avoid load more too fast
            hasMore ? 800 : 0
          );
        })
        .catch((err) => {
          setLoading(false);
          console.error(err);
        });
    },
    [spaceId, q, offset, setList, menuId]
  );

  useEffect(() => {
    if (intersection && intersection.intersectionRatio === 1 && !loading && hasMore) {
      getLists();
    }
  }, [intersection, loading, hasMore, getLists]);

  useEffect(() => {
    if (spaceId) {
      getLists({ refresh: true });
    }
  }, [spaceId, q, menuId]);

  useEffect(() => {
    const editor = creatingEditorRef.current;
    if (editor && menuContext.searchText) {
      editor.update(() => {
        const root = $getRoot();
        root.getChildren().forEach((node) => {
          node.remove();
        });
        const paragraphNode = $createParagraphNode();
        const textNode = $createTextNode(menuContext.searchText);
        paragraphNode!.append(textNode);

        root.append(paragraphNode);
      });
    }
  }, [spaceId, menuId]);

  const clearEditor = (_editor: LexicalEditor) => {
    _editor.update(() => {
      $getRoot().clear().append($createParagraphNode());
    });
  };

  const create = useCallback(async () => {
    try {
      if (!creatingEditorRef.current) {
        throw new Error('creatingEditorRef is null');
      }

      const content = JSON.stringify(creatingEditorRef.current.getEditorState());
      setCreating(true);
      await api.post(`/api/v1/s/${spaceId}/createPost`, {
        content,
      });
      setCreating(false);
      clearEditor(creatingEditorRef.current!);
      getLists({ refresh: true });
    } catch (error) {
      setCreating(false);
      console.error(error);
    }
  }, [spaceId, getLists]);

  const onToggleEdit = (post: Post, state?: string) => {
    setList((draft) => {
      const item = draft.find((i) => i.id === post.id);
      if (item) {
        item.editable = !item.editable;
        if (state !== undefined) {
          item.content = state;
        }
      }
    });
  };

  const onUpdate = async (content: string, post: Post) => {
    try {
      await api.post(`/api/v1/s/${spaceId}/updatePost/${post.id}`, {
        content,
      });
      onToggleEdit(post, content);
    } catch (error) {
      console.error(error);
    }
  };

  const onDelete = useCallback(
    async (post: Post) => {
      try {
        await api.post(`/api/v1/s/${spaceId}/deletePost/${post.id}`);
        setList((draft) => {
          const idx = draft.findIndex((i) => i.id === post.id);
          draft.splice(idx, 1);
        });
      } catch (error) {
        console.error(error);
      }
    },
    [spaceId, setList]
  );

  const setEditable = useCallback((post: Post) => {
    setEditingOriginState(post.content);
    onToggleEdit(post, `${EditUtil.randomEvent()}${post.content}`);
  }, []);

  const toPost = (post: Post) => {
    navigate(`/s/${spaceId}/p/${post.id}`);
  };

  return (
    <Wrapper>
      {!fullScreen && (
        <LayoutHeader title={title}>
          <SearchField
            id="input-search"
            variant="outlined"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearchParams({ q: keyword });
              }
            }}
            fullWidth
            InputProps={{
              style: {
                height: '2rem',
                borderRadius: '0.5rem',
              },
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </LayoutHeader>
      )}
      <Editor
        className="editor-new"
        minRows={3}
        height={fullScreen ? 'calc(100vh - 38px)' : ''}
        editorRef={creatingEditorRef}
        onSubmit={create}
        editable
        placeholder="现在的想法是..."
        footer={() => (
          <Box className="flex justify-between items-center">
            <Box />
            <Box className="flex items-center">
              <IconButton
                className="text-xl"
                sx={{ color: 'text.secondary' }}
                onClick={toggleFullScreen}>
                <Fullscreen />
              </IconButton>
              <SendButton loading={creating} onClick={create} />
            </Box>
          </Box>
        )}
      />

      {list.map((post) => (
        <ListItem
          key={post.id}
          post={post}
          onEdit={() => setEditable(post)}
          onCancel={() => {
            onToggleEdit(post, editingOriginState);
            setEditingOriginState(undefined);
          }}
          onUpdate={(content) => onUpdate(content, post)}
          onDetail={() => toPost(post)}
          onDelete={() => onDelete(post)}
        />
      ))}

      {list.length > 0 && (
        <Box ref={intersectionRef} className="text-center text-sm">
          -- {hasMore || loading ? '加载中' : '我是有底线的'} --
        </Box>
      )}
    </Wrapper>
  );
}

const Wrapper = styled(Box)(
  ({ theme }) => `
  .date {
    color: ${theme.vars.palette.text.secondary};
  }
  .editor-card, .editor-new {
    background-color: #fbfbfb;
    ${theme.getColorSchemeSelector('dark')} {
      background-color: ${theme.vars.palette.grey[900]};
    }
    border-radius: 8px;
    padding: 8px 16px;
    margin-bottom: 15px;
  }

  .post-header {
    padding-top: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .date {
    font-size: 12px;
    transform: translateY(-8px);
  }

  .tag {
    margin-right: 8px;
  }
`
);

const SearchField = styled(TextField)(
  ({ theme }) => `
  .MuiOutlinedInput-notchedOutline {
    border: none;
  }
  .MuiOutlinedInput-root {
    border-radius: 0.5rem;
    padding-left: 0.8rem;
    background-color: ${theme.vars.palette.grey[200]};
    ${theme.getColorSchemeSelector('dark')} {
      background-color: ${theme.vars.palette.grey[800]};
    }
  }
  .MuiSvgIcon-root {
    font-size: 1.2rem;
    color: ${theme.vars.palette.grey[400]};
    ${theme.getColorSchemeSelector('dark')} {
      color: ${theme.vars.palette.grey[600]};
    }
  }
`
);
