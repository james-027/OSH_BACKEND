import { BadRequestException } from "@nestjs/common";

export const attachmentFileFilter = (
    req: any,
    file: Express.Multer.File,
    cb: Function,
) => {
    const allowedMimeTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(
            new BadRequestException(
                "Only PDF, JPG, PNG, and WEBP files are allowed.",
            ),
            false,
        );
    }

    cb(null, true);
};