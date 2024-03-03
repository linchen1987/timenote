import { useState, useRef, useCallback, useMemo } from 'react';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
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
import { LexicalEditor, $getSelection, $isRangeSelection } from 'lexical';

import Editor from '../../editor';
import { formatDateTime } from '../../utils';
import { useSpace } from '../../contexts/spaces';
import SendButton from './SendButton';
import type { Post } from './types';

export default function ListItem({
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
}) {
  const { createMenu } = useSpace();
  const editorRef = useRef<LexicalEditor>();
  const [showDialog, setShowDialog] = useState(false);
  const [menuName, setMenuName] = useState('');
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    try {
      onUpdate(content);
      setLoading(false);
    } catch {
      setLoading(false);
    }
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
                  {!loading && (
                    <Button
                      sx={{ mr: 1, color: 'text.secondary', fontSize: '0.8rem' }}
                      onClick={onCancel}>
                      Cancel
                    </Button>
                  )}
                  <SendButton onClick={onSubmit} loading={loading} />
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
}
