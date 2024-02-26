const removeEvent = (str: string) => str.replace(/^event:\d*/, '');
const randomEvent = () => `event:${Math.floor(Math.random() * 1e8)}`;

export { removeEvent, randomEvent };
export default {
  removeEvent,
  randomEvent,
};
