import { createTransport } from "nodemailer";

export const transporter = createTransport({
	host: process.env.NODEMAILER_HOST,
	port: parseInt(process.env.NODEMAILER_PORT || "587"),
	secure: false,
	auth: {
		user: process.env.NODEMAILER_EMAIL,
		pass: process.env.NODEMAILER_PASSWORD,
	},
});

export async function sendMail(
	data: { to: string | string[]; subject: string; from?: string } & ({ text: string } | { html: string })
) {
	try {
		return await transporter.sendMail({
			...data,
			from: data.from || process.env.NODEMAILER_EMAIL,
		});
	} catch (e) {
		console.log(e);
		return e;
	}
}
