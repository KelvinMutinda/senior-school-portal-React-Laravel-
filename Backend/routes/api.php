<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\LearnerController;
use App\Http\Controllers\TeacherController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\LearnerPortalController;

    Route::get('/learner/dashboard', [LearnerPortalController::class, 'dashboard']);

// Sign in
Route::post('/login', [LoginController::class, 'login']);

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function () {
    // Sign out
    Route::post('/logout', [LoginController::class, 'logout']);

    Route::post('/change-password', [LoginController::class, 'changePassword'])
        ->middleware('throttle:6,1');

    Route::post('/teachers', [TeacherController::class, 'store']);

    // Registration now needs a signed-in user, so registered_by gets filled in.
    Route::post('/learners', [LearnerController::class, 'store']);
});