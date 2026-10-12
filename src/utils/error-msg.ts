export default (error?: string | Error): string => {
  let str = 'something broke. I don\'t know what you did, but I know you did it.';

  if (error) {
    if (typeof error === 'string') {
      str = `😤 for cryin' out loud: ${error}`;
    } else if (error instanceof Error) {
      str = `😤 for cryin' out loud: ${error.message}`;
    }
  }

  return str;
};
