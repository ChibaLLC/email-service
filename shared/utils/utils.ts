import { z } from "zod";

export const emailShema = z.object({
	email: z
		.string()
		.email()
		.refine((email) => email.endsWith("sutit.org"), "Your email needs to be a sutit email. :("),
});
