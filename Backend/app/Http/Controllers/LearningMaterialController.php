<?php

namespace App\Http\Controllers;

use App\Models\LearningMaterial;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class LearningMaterialController extends Controller
{
    /**
     * GET /api/learning-materials
     * Optional query string:
     *   ?class_name=10A   only that class
     *   ?subject=Mathematics
     *   ?search=quadratic  matches title, description or subject
     *   ?mine=1           only materials uploaded by the signed-in user
     */
    public function index(Request $request)
    {
        $userId = $request->user()?->id;

        $materials = LearningMaterial::with('uploader:id,name')
            ->when($request->query('class_name'), fn ($q, $v) => $q->where('class_name', $v))
            ->when($request->query('subject'), fn ($q, $v) => $q->where('subject', $v))
            ->when($request->boolean('mine'), fn ($q) => $q->where('uploaded_by', $userId))
            ->when($request->query('search'), function ($q, $term) {
                $q->where(function ($w) use ($term) {
                    $w->where('title', 'like', "%{$term}%")
                      ->orWhere('description', 'like', "%{$term}%")
                      ->orWhere('subject', 'like', "%{$term}%");
                });
            })
            ->latest()
            ->get()
            ->map(fn (LearningMaterial $m) => [
                'id'          => $m->id,
                'title'       => $m->title,
                'description' => $m->description,
                'class_name'  => $m->class_name,
                'subject'     => $m->subject,
                'file_name'   => $m->file_name,
                'file_type'   => $m->file_type,
                'file_size'   => $m->file_size,
                'file_url'    => $m->file_url,
                'uploaded_by' => $m->uploader?->name,
                'is_mine'     => $m->uploaded_by === $userId, // frontend shows Delete only when true
                'created_at'  => $m->created_at,
            ]);

        return response()->json($materials, 200);
    }

    public function store(Request $request)
    {
        // Only teachers upload materials
        if ($request->user()?->role !== 'TEACHER') {
            return response()->json(['message' => 'Only teachers can upload materials.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'title'       => 'required|string|max:255',
            'class_name'  => 'required|string|max:255',
            'subject'     => 'required|string|max:255',
            'description' => 'required|string|max:255',
            'file'        => 'required|file|mimes:pdf,doc,docx,ppt,pptx,mp4|max:51200', // 50 MB
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $file = $request->file('file');
        $path = $file->store('materials', 'public');

        $material = LearningMaterial::create([
            'title'       => $request->title,
            'class_name'  => $request->class_name,
            'subject'     => $request->subject,
            'description' => $request->description,
            'file_path'   => $path,
            'file_name'   => $file->getClientOriginalName(),
            'file_type'   => $file->getClientOriginalExtension(),
            'file_size'   => $file->getSize(),
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json([
            'message'  => 'Material uploaded successfully',
            'material' => $material,
        ], 201);
    }

    public function show(LearningMaterial $learningMaterial)
    {
        return response()->json($learningMaterial->load('uploader:id,name'), 200);
    }

    public function destroy(Request $request, LearningMaterial $learningMaterial)
    {
        // Only the uploader can delete their material
        if ($learningMaterial->uploaded_by !== $request->user()?->id) {
            return response()->json(['message' => 'You can only delete your own materials.'], 403);
        }

        if ($learningMaterial->file_path) {
            Storage::disk('public')->delete($learningMaterial->file_path);
        }
        $learningMaterial->delete();

        return response()->json(['message' => 'Material deleted.'], 200);
    }
}