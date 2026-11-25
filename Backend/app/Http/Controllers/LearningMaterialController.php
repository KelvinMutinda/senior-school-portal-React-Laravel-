<?php

namespace App\Http\Controllers;

use App\Models\LearningMaterial;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class LearningMaterialController extends Controller
{
   
    public function index()
    {
        $materials = LearningMaterial::latest()->get(); 
        return response()->json($materials, 200);
    }


    public function create()
    {
        //
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title'       => 'required|string|max:255',
            'class_name'  => 'required|string|max:255',
            'subject'     => 'required|string|max:255',
            'description' => 'required|string|max:255',
            'file'        => 'required|file|mimes:pdf,doc,docx,ppt,pptx,mp4|max:51200', 
        ]);

    
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $path = null; 

        if ($request->hasFile('file')) {
            $path = $request->file('file')->store('materials', 'public');
        }

        $material = LearningMaterial::create([
            'title'       => $request->title,
            'class_name'  => $request->class_name,
            'subject'     => $request->subject,
            'description' => $request->description,
            'file_path'   => $path
        ]);

        return response()->json([
            'message'  => 'Material Uploaded successfully',
            'material' => $material,
        ], 201);
    }

   
    public function show(LearningMaterial $learningMaterial)
    {
        return response()->json($learningMaterial, 200); 
    }

    
    public function edit(LearningMaterial $learningMaterial)
    {
       
    }

    public function update(Request $request, LearningMaterial $learningMaterial)
    {
     
    }

 
    public function destroy(LearningMaterial $learningMaterial)
    {
    
    }
}