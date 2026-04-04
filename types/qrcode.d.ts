declare module "qrcode" {
  interface ToDataURLOptions {
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(
    text: string,
    options?: ToDataURLOptions
  ): Promise<string>;
}
