declare module 'multer' {
    export function diskStorage(options: {
        destination?: unknown;
        filename?: unknown;
    }): unknown;
}
