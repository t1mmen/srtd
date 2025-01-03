import { Text } from 'ink';
import React from 'react';
import { COLOR_SUCCESS } from './customTheme.js';

export const TimeSince: React.FC<{ date?: string }> = ({ date }) => {
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!date) return <Text>never</Text>;

  const parsedDate = new Date(date);

  const diff = Math.abs(now.getTime() - parsedDate.getTime());
  const seconds = Math.floor(diff / 1000);

  if (seconds < 5) return <Text color={COLOR_SUCCESS}>just now</Text>;
  if (seconds < 60) return <Text>{seconds}s ago</Text>;
  if (seconds < 3600) return <Text>{Math.floor(seconds / 60)}m ago</Text>;
  if (seconds < 86400) return <Text>{Math.floor(seconds / 3600)}h ago</Text>;
  return <Text>{Math.floor(seconds / 86400)}d ago</Text>;
};
