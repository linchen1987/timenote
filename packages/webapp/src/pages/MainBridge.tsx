import { useNavigate, useParams } from 'react-router-dom';

import { useSpace } from '../contexts/spaces';
import List from './List';
import { useEffect } from 'react';

export default function MainBridge() {
  const { spaceId, menuId } = useParams();
  const navigate = useNavigate();
  const { menus } = useSpace();

  const postId = (menus || []).find((m) => m.id === menuId)?.postId;

  useEffect(() => {
    if (postId) {
      navigate(`/s/${spaceId}/m/${menuId}/p/${postId}`);
      return;
    }
  });

  return <List />;
}
