import { exec } from 'node:child_process';

export const shell = (
  command: string,
  callback: (output: string) => void,
  error?: () => {}
) => {
  exec(command, (err, output) => {
    if (err) {
      console.error(`could not execute  ${command}: `, err);
      error && error();
      return;
    }
    callback(output);
  });
};
