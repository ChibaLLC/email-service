import { z } from "zod";

export const emailShema = z.object({
	email: z
		.string()
		.email()
		.refine(
			(email) => validateEmail(email).valid,
			"Your email needs to either be a sutit or chiba email. :("
		),
});

export type EmailValidationResult = {
	valid: boolean;
	type: "sutit" | "chiba" | "unknown" | undefined;
};

export function validateEmail(email: string): EmailValidationResult {
	if (!email) return { valid: false, type: undefined };

	switch (true) {
		case email.endsWith("sutit.org"):
			return { valid: true, type: "sutit" };
		case email.endsWith("chiba.llc"):
			return { valid: true, type: "chiba" };
		default:
			return { valid: false, type: "unknown" };
	}
}
