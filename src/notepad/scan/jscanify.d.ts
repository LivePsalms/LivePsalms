// jscanify ships no type declarations. The deskew module (deskew.ts) lazily
// imports the browser build via the `./client` subpath export and treats the
// instance as `any`, so a bare module declaration satisfies `tsc -b` (TS7016).
declare module 'jscanify/client';
