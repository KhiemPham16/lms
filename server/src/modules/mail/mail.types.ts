export type ForgotPasswordMailData = {
    email: string;
    fullName: string;
    otp: string;
};

export type ActivationMailData = {
    email: string;
    fullName: string;
    status: string;
};

export type MailJob =
    | {
          name: 'forgot-password';
          data: ForgotPasswordMailData;
      }
    | {
          name: 'activation';
          data: ActivationMailData;
      };
