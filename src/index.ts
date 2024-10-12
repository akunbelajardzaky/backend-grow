import { Elysia } from "elysia";
import { PrismaClient } from "@prisma/client";
import { HttpStatusCode } from "elysia-http-status-code";
import cloudinary from "cloudinary";
import multer from "multer";
import stream from "stream";

import swagger from "@elysiajs/swagger";

const upload = multer({ dest: "uploads/" });

const prisma = new PrismaClient();
cloudinary.v2.config({
  cloud_name: "derwgb2aj",
  api_key: "929621512747955",
  api_secret: "7B76DdeWc6MrdFgb6tiNRwVfU5Q",
});

new Elysia()
  .use(HttpStatusCode())

  .use(
    swagger({
      path: "/docs",
      version: "1",
    })
  )

  // Get all blogs with pagination
  .get("/blog", async ({ query }) => {
    const page = parseInt(query.page ?? "1"); // Default page 1 if undefined
    const limit = parseInt(query.limit ?? "5"); // Default limit 5 if undefined
    const skip = (page - 1) * limit;

    try {
      const total_data = await prisma.blog.count(); // Count total number of blogs
      const blogs = await prisma.blog.findMany({
        skip,
        take: limit,
      });

      const total_page = Math.ceil(total_data / limit);
      const pagination = {
        total_data: total_data,
        jumlah_page: total_page,
        prev: page > 1 ? page - 1 : null,
        page,
        next: page < total_page ? page + 1 : null,
        detail: blogs.map((blog) => blog.id),
        start: skip + 1,
        end: skip + blogs.length,
      };

      return {
        status: 200,
        message: "Successfully retrieved blogs",
        result: {
          data: blogs,
          pagination,
        },
      };
    } catch (error) {
      return {
        status: 500,
        message: "Error retrieving blogs",
      };
    }
  })

  // Get a single blog by id
  .get("/blog/:id", async ({ params }) => {
    const { id } = params;

    if (isNaN(Number(id))) {
      return {
        status: 400,
        message: "ID must be a number",
      };
    }

    try {
      const blog = await prisma.blog.findUnique({
        where: {
          id: Number(id),
        },
      });

      if (!blog) {
        return {
          status: 404,
          message: "Blog not found",
        };
      }

      return {
        status: 200,
        message: "Successfully retrieved the blog",
        result: {
          data: blog,
        },
      };
    } catch (error) {
      return {
        status: 500,
        message: "Error retrieving the blog",
      };
    }
  })

  // Create a new blog
  .post("/blog", async ({ body }) => {
    // Assert the body has the correct type
    const { judul, deskripsi, gambar } = body as {
      judul: string;
      deskripsi?: string;
      gambar?: string;
    };

    try {
      const newBlog = await prisma.blog.create({
        data: {
          judul,
          deskripsi,
          gambar,
        },
      });

      return {
        status: 201,
        message: "Successfully created the blog",
        result: {
          data: newBlog,
        },
      };
    } catch (error) {
      return {
        status: 500,
        message: "Error creating the blog",
      };
    }
  })

  // Update an existing blog by id
  .put("/blog/:id", async ({ params, body }) => {
    const { id } = params;

    if (isNaN(Number(id))) {
      return {
        status: 400,
        message: "ID must be a number",
      };
    }

    // Assert the body has the correct type
    const { judul, deskripsi, gambar } = body as {
      judul: string;
      deskripsi?: string;
      gambar?: string;
    };

    try {
      const updatedBlog = await prisma.blog.update({
        where: {
          id: Number(id),
        },
        data: {
          judul,
          deskripsi,
          gambar,
          updated_at: new Date(),
        },
      });

      return {
        status: 200,
        message: "Successfully updated the blog",
        result: {
          data: updatedBlog,
        },
      };
    } catch (error) {
      return {
        status: 500,
        message: "Error updating the blog",
      };
    }
  })

  // Delete a blog by id
  .delete("/blog/:id", async ({ params }) => {
    const { id } = params;

    if (isNaN(Number(id))) {
      return {
        status: 400,
        message: "ID must be a number",
      };
    }

    try {
      await prisma.blog.delete({
        where: {
          id: Number(id),
        },
      });

      return {
        status: 200,
        message: "Successfully deleted the blog",
      };
    } catch (error) {
      return {
        status: 500,
        message: "Error deleting the blog",
      };
    }
  })

  .post("/carousell", async ({ body }) => {
    const { file } = body as { file: any };

    if (!file) {
      return {
        status: 400,
        message: "File is required",
      };
    }

    try {
      // Jika file adalah Blob, konversi ke Buffer
      const buffer = Buffer.isBuffer(file)
        ? file
        : Buffer.from(await file.arrayBuffer());

      // Gunakan Promise untuk menangani upload
      const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.v2.uploader.upload_stream(
          { resource_type: "auto" },
          async (error, result) => {
            if (error) {
              console.error(error);
              return reject(new Error("Upload failed"));
            }

            // Simpan hasil upload ke database
            const ctx = await prisma.assets.create({
              data: result as any,
            });

            console.log("Upload successful:", result);
            resolve(ctx); // Resolves with the created context
          }
        );

        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);
        bufferStream.pipe(uploadStream);
      });

      const ctx = await uploadPromise; // Tunggu hasil upload

      return {
        status: 200,
        message: "Upload successful",
        data: ctx, // Kembalikan hasil database
      };
    } catch (error) {
      console.error(error);
      return {
        status: 500,
        message: "Error uploading file",
      };
    }
  })

  .delete("/carousell", async ({ body }) => {
    const { asset_id } = body as { asset_id: any };

    const uploadPromise = new Promise(async (resolve, reject) => {
      const data = await prisma.assets.findFirst({
        where: {
          asset_id: asset_id,
        },
      });

      cloudinary.v2.uploader
        .destroy(data?.public_id as string, async function (error, result) {
          resolve(result || error);

          if (result.result === "ok") {
            await prisma.assets.delete({
              where: {
                asset_id: data?.asset_id,
              },
            });
          }
        })
        .then((result) => {
          console.log(result);

          resolve(result);
        });
    });

    const ctx = await uploadPromise; // Tunggu hasil upload

    return ctx;
  })

  .get("/carousell", async () => {
    const data = await prisma.$queryRaw`SELECT * FROM assets`;

    return {
      status: 200,
      message: "price",
      result: {
        data,
      },
    };
  })
  .get("/pricelist", async () => {
    const data = await prisma.$queryRaw`SELECT * FROM pricing_list`;

    return {
      status: 200,
      message: "price",
      result: {
        data,
      },
    };
  })

  .put("/pricelist", async ({ body }) => {
    const { id, harga, keterangan } = body as {
      id: any;
      harga: number;
      keterangan: string;
    };

    const data = await prisma.pricing_list.update({
      where: {
        id: id,
      },

      data: {
        harga: harga,
        keterangan: keterangan,
      },
    });

    return {
      status: 200,
      message: "price",
      result: {
        data,
      },
    };
  })
  .listen(3000);

console.log("Server running on port 3000");
