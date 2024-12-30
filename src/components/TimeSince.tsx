import { Text } from 'ink';
import React from 'react';

export const TimeSince: React.FC<{ date?: string }> = ({ date }) => {
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!date) return <Text>never</Text>;

  const diff = now.getTime() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return <Text>{seconds}s</Text>;
  if (seconds < 3600) return <Text>{Math.floor(seconds / 60)}m</Text>;
  if (seconds < 86400) return <Text>{Math.floor(seconds / 3600)}h</Text>;
  return <Text>{Math.floor(seconds / 86400)}d</Text>;
};
