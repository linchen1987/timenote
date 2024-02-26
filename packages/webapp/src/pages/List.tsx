import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useImmer } from 'use-immer';
import { styled } from '@mui/material/styles';
import { useIntersection } from 'react-use';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Fullscreen from '@mui/icons-material/Fullscreen';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import {
  LexicalEditor,
  $getRoot,
  $getSelection,
  $createParagraphNode,
  $createTextNode,
  $isRangeSelection,
} from 'lexical';

import Editor from '../editor';
import EditUtil from '../editor/utils';
import LayoutHeader from '../components/LayoutHeader';
// import Tag from '../components/Tag';
import { formatDateTime } from '../utils';
import { useSpace } from '../contexts/spaces';
import api from '../utils/api';

type Post = {
  id: string;
  content: string;
  editable: boolean;
  createdAt: string;
};

const ListItem = ({
  post,
  onEdit,
  onCancel,
  onUpdate,
  onDetail,
  onDelete,
}: {
  post: Post;
  onEdit: () => void;
  onCancel: () => void;
  onUpdate: (content: string) => void;
  onDetail: () => void;
  onDelete: () => void;
}) => {
  const { createMenu } = useSpace();
  const editorRef = useRef<LexicalEditor>();
  const [showDialog, setShowDialog] = useState(false);
  const [menuName, setMenuName] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openAction = Boolean(anchorEl);
  const handleOpenAction = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleActionClose = () => {
    setAnchorEl(null);
  };

  const onEditable = useCallback(() => {
    onEdit();
    setTimeout(() => {
      editorRef.current!.focus();
      editorRef.current!.update(() => {
        // set cursor to the end
        const selection = $getSelection();
        if (selection) {
          if ($isRangeSelection(selection)) {
            selection.modify('move', false, 'lineboundary');
          }
        }
      });
    }, 100);
  }, [onEdit]);

  const onSubmit = () => {
    const content = JSON.stringify(editorRef.current!.getEditorState());
    onUpdate(content);
  };

  const onSendToMenu = () => {
    setShowDialog(true);
  };

  const doSendToMenu = async () => {
    try {
      await createMenu({
        name: menuName,
        type: 'post',
        config: {
          postId: post.id,
        },
      });
      handleCloseDialog();
    } catch (error) {
      console.error(error);
    }
  };

  const menus = useMemo(
    () => [
      {
        key: 'edit',
        label: <Box>Edit</Box>,
        icon: <EditOutlinedIcon className="mr-2 text-xl" />,
        action: onEditable,
      },
      {
        key: 'edit',
        label: <Box>Add to menu</Box>,
        icon: <SendIcon className="mr-2 text-xl" />,
        action: onSendToMenu,
      },
      {
        key: 'delete',
        label: <Box color="error.main">Delete</Box>,
        icon: (
          <DeleteOutlineOutlinedIcon
            className="mr-2 text-xl"
            sx={{ color: 'error.main' }}
          />
        ),
        action: onDelete,
      },
    ],
    [onDelete, onEditable]
  );

  const handleCloseDialog = () => {
    setShowDialog(false);
    setMenuName('');
  };

  return (
    <Box mt={2}>
      <Editor
        // highlightSearch={keyword}
        editorRef={editorRef}
        editable={post.editable}
        editorState={post.content}
        onSubmit={() => onSubmit()}
        onEditable={() => onEditable()}
        className="editor-card"
        header={() =>
          !post.editable && (
            <Box className="post-header">
              <Box className="date cursor-pointer" onClick={onDetail}>
                {formatDateTime(post.createdAt)}
              </Box>
              <IconButton
                className=" -mt-4"
                sx={{ color: 'text.secondary' }}
                onClick={handleOpenAction}>
                <MoreHorizIcon className="text-xl" />
              </IconButton>
            </Box>
          )
        }
        footer={() =>
          post.editable && (
            <Box className="flex justify-between items-center">
              <Box className="flex justify-between items-center">{/* tool bar */}</Box>
              {post.editable && (
                <Box className="flex items-center">
                  <Button
                    sx={{ mr: 1, color: 'text.secondary', fontSize: '0.8rem' }}
                    onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button className="btn-create" variant="contained" onClick={onSubmit}>
                    <SendIcon />
                  </Button>
                </Box>
              )}
            </Box>
          )
        }
      />
      <Menu
        id="lock-menu"
        anchorEl={anchorEl}
        open={openAction}
        onClose={handleActionClose}
        MenuListProps={{
          'aria-labelledby': 'lock-button',
          role: 'listbox',
        }}>
        {menus.map((menu) => (
          <MenuItem
            key={menu.key}
            onClick={(e) => {
              e.stopPropagation();
              handleActionClose();
              menu.action();
            }}>
            <Box className="flex items-center">
              {menu.icon}
              {menu.label}
            </Box>
          </MenuItem>
        ))}
      </Menu>
      {showDialog && (
        <Dialog open onClose={handleCloseDialog} fullWidth maxWidth="sm">
          <DialogTitle>Send to Menu</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              required
              margin="dense"
              id="name"
              label="Name"
              fullWidth
              variant="standard"
              value={menuName}
              onChange={(e) => setMenuName(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button sx={{ color: 'text.secondary' }} onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button disabled={!menuName} onClick={doSendToMenu}>
              Create
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

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
      await api.post(`/api/v1/s/${spaceId}/createPost`, {
        content,
      });
      clearEditor(creatingEditorRef.current!);
      getLists({ refresh: true });
    } catch (error) {
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
              <Button className="btn-create" variant="contained" onClick={() => create()}>
                <SendIcon />
              </Button>
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

  .btn-create {
    padding: 0.375rem 0.875rem;
    border-radius: 0.5rem;

    min-width: auto;
    box-shadow: none;
    color: ${theme.vars.palette.primary.contrastText};
    .MuiSvgIcon-root {
      font-size: 1.1rem;
    }
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
