import { geocodeLocation } from "@/lib/routing";
import { geocodeQuerySchema } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = geocodeQuerySchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        {
          message: "Search text must be at least 2 characters long.",
        },
        { status: 400 },
      );
    }

    const suggestions = await geocodeLocation(payload.data.query);

    return NextResponse.json(suggestions);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "SnowRoute could not search that location just now.",
      },
      { status: 500 },
    );
  }
}
