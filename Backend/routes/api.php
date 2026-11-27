<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\LearnerController;
use App\Http\Controllers\LearnerPortalController;
use App\Http\Controllers\LearningMaterialController;
use App\Http\Controllers\TeacherDashboardController;
use App\Http\Controllers\MarksController;
use App\Http\Controllers\ResultsController;
use App\Http\Controllers\TeacherController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\LearnerDetailsController;
use App\Http\Controllers\LearnerCountController;


// Sign in (public)

Route::post('/login', [LoginController::class, 'login']);


Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', fn (Request $request) => $request->user());

    // Sign out
    Route::post('/logout', [LoginController::class, 'logout']);
    Route::get('/teacher/profile',[TeacherDashboardController::class,'show']);

    
    Route::get('/learners', [LearnerCountController::class, 'index']);
    Route::put('/learners/{id}', [LearnerCountController::class, 'update']);
    Route::delete('/learners/{id}', [LearnerCountController::class, 'destroy']);


    Route::post('/change-password', [LoginController::class, 'changePassword'])
        ->middleware('throttle:6,1');

    Route::post('/teachers', [TeacherController::class, 'store']);

    // Registration needs a signed-in user, so registered_by gets filled in.
    Route::post('/learners', [LearnerController::class, 'store']);

    // Learner portal
    Route::get('/learner/dashboard', [LearnerPortalController::class, 'dashboard']);
    Route::get('/learner/profile', [LearnerDetailsController::class, 'show']);

    // Learning materials
    Route::get('/learning-materials/{learning_material}/download', [LearningMaterialController::class, 'download']);
    Route::apiResource('learning-materials', LearningMaterialController::class)
        ->only(['index', 'store', 'show', 'destroy']);

    // Marks entry (the controller checks the role: teacher, Deputy or HOI)
    Route::get('/marks/options', [MarksController::class, 'options']);
    Route::get('/marks/sheet',   [MarksController::class, 'sheet']);
    Route::post('/marks/draft',  [MarksController::class, 'saveDraft']);
    Route::post('/marks/submit', [MarksController::class, 'submit']);

    Route::post('/exam-types',        [MarksController::class, 'storeExamType']);
    Route::delete('/exam-types/{id}', [MarksController::class, 'destroyExamType']);

    // Results and analysis (HOI, Deputy and Teacher; the controller checks the role)
    Route::get('/results/options',  [ResultsController::class, 'options']);
    Route::get('/results/analysis', [ResultsController::class, 'analysis']);
    Route::get('/results/class',    [ResultsController::class, 'classResults']);

    // HOI or Deputy approves (publishes) or returns a submitted marks sheet
    Route::post('/marks/review', [ResultsController::class, 'review']);
});