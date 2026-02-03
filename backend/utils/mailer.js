import nodemailer from "nodemailer";
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "collinchukss@gmail.com",
    pass: "1234",
  },
});
export const sendMatchEmail = async (to, subject, html) => {
  await transporter.sendMail({
    from: '"Study Group Match" collinchukss@gmail.com',
    to,
    subject,
    html,
  });
};
